# pylint: disable=C0103, E1101
"""-----------------------------------------------------------------------------
Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
#----------------------------------------------------------------------------"""
#-------------------------------------------------------------------------------
# Name:         Adopta GP Authentication
# Purpose:      GP service to add users and send sign up emails for new users,
#               send login emails with list of adopted asset as links to existing users
# Inputs:       This script takes the following inputs:
#               -----user provided, exposed at REST:
#                       1. input_user_email: user's email address
#                       2. action: To determine if the user is logging in or
#                               signing up
#                       3. appurl: Contains the base url of the application without
#                               any url parameters
#                       4. widget_config: receive widget configuration from widget
#                       5. asset_popup_config: receive configured popup text from widget
#                               e.g., "Hydrant: {nickname}"
#                       6. signup_fields: receive {"field":"value", "field":"value"}
#                               used to update additional fields in user table
#                               e.g., firstname, lastname, teamname
#                       7. adopted_assetid: receive asset objectid to adopt while signing up
#                       8. userid: guid in url parameter when login link is clicked in email
#                       9. usertoken: guid in url parameter when login link is clicked in email
#               -----constants in gpservice, not exposed in REST:
#                       10. user_table: path to user table in workgroup/enterprise gdb
#                       11. user_email_field: field to store email address
#                       12. user_team_field: field to store team names
#                       13. user_token_field: field to store guid token for user
#                       14. asset_layer_url: URL to the feature service (with layer id)
#                               containing assets
#                       15. assetlyr_username: Credentials to access the feature service
#                       16. assetlyr_password: Credentials to access the feature service
#                       17. assetlyr_portalurl: portal url where asset layer is hosted
#                       18. from_address: The email from which the email will be sent
#                       19. signup_email_subject: subject line to use for sign up emails
#                       20. signup_template: The html template containing the
#                               email body. Used when action is 'signup'.
#                       21. login_email_subject: subject line to use for login emails
#                       22. login_template: The html template containing the email
#                               body. Used when action is 'login'
#                       23. smtpserver:  SMTP server address/host:port
#                       24. smtpusername: SMTP user name
#                       25. smtppassword: SMTP user password
#                       26. usetls: Boolean to check if to use TLS.
#
#             The constants are set as constant value while
#             publishing the geoprocessing service.
#-------------------------------------------------------------------------------

#----------------------------- imports ----------------------------------------#
from re import findall, match
from re import IGNORECASE
from json import loads
from uuid import uuid4

import datetime
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from smtplib import SMTP
from arcrest.security import AGOLTokenSecurityHandler
from arcrest.security import PortalTokenSecurityHandler
from arcrest.agol import FeatureLayer
import arcpy
#------------------------------------------------------------------------------#

# used in login email when no assets are adopted
no_assets_message = "No assets adopted yet"
# read gp parameters
input_user_email = arcpy.GetParameterAsText(0)
action = arcpy.GetParameterAsText(1)
appurl = arcpy.GetParameterAsText(2)
user_table = arcpy.GetParameter(3)
user_email_field = arcpy.GetParameterAsText(4)
user_team_field = arcpy.GetParameterAsText(5)
user_token_field = arcpy.GetParameterAsText(6)
token_date_field = arcpy.GetParameterAsText(7)
token_expiry_minutes = arcpy.GetParameterAsText(8)
assetlyr_url = arcpy.GetParameterAsText(9)
assetlyr_username = arcpy.GetParameterAsText(10)
assetlyr_password = arcpy.GetParameterAsText(11)
assetlyr_portalurl = arcpy.GetParameterAsText(12)
from_address = arcpy.GetParameterAsText(13)
signup_email_subject = arcpy.GetParameterAsText(14)
signup_template = arcpy.GetParameterAsText(15)
login_email_subject = arcpy.GetParameterAsText(16)
login_template = arcpy.GetParameterAsText(17)
smtp_server = arcpy.GetParameterAsText(18)
smtp_username = arcpy.GetParameterAsText(19)
smtp_password = arcpy.GetParameterAsText(20)
use_tls = arcpy.GetParameterAsText(21)
signup_fields = '{"FIRSTName":"value", "TEAMNAME":"value"}' #arcpy.GetParameterAsText(22)
asset_popup_config = arcpy.GetParameterAsText(23)
widget_config = arcpy.GetParameterAsText(24)
adopted_assetid = arcpy.GetParameterAsText(25)
url_userid = arcpy.GetParameterAsText(26)
url_usertoken = arcpy.GetParameterAsText(27)

def send_msg(message, messagetype="message",):
    """ output messages to stdout as well as arcpy """
    if messagetype.lower() == "message":
        arcpy.AddMessage(message)
    if messagetype.lower() == "warning":
        arcpy.AddWarning(message)
    if messagetype.lower() == "error":
        if arcpy.ProductInfo() != "ArcServer":
            arcpy.AddError("Failed. " + message)
        else:
            arcpy.AddMessage("Failed. " + message)
        # set the result_output parameter
        out_message = {"status":"Failed", "description":message}
        arcpy.SetParameterAsText(28, out_message)
    if messagetype.lower() == "success":
        # set the result_output parameter in case of success
        out_message = {"status":"Success", "description":message}
        arcpy.SetParameterAsText(28, out_message)
    print message

# validate input email address

def validate_user_table():
    """ validates user table schema requirements """
    # do these checks only when run in desktop while publishing
    # this check is not required on server after publishing as gp service
    if arcpy.ProductInfo() == "ArcServer":
        return True
    if not arcpy.Exists(user_table):
        send_msg("User table does not exist", "error")
        return False

    desc = arcpy.Describe(user_table)
    # check if user table has globalid enabled
    if not desc.hasGlobalID:
        send_msg("User table does not have globalids enabled.", "error")
        return False
    # check if user table is an enterprise gdb
    workspace_props = arcpy.Describe(desc.path)
    if workspace_props.workspaceFactoryProgID == "esriDataSourcesGDB.SdeWorkspaceFactory.1":
        return True
    else:
        send_msg("User table must be sourced from an enterprise geodatabase", "error")
        return False

def initialize_securityhandler(url, username, password):
    """ initialize AGOL/Portal security handler """
    try:
        # if user has provided credentials
        if len(username) > 0 and len(password) > 0:
            # check if its AGOL or Portal
            if "arcgis.com" in url.lower():
                agol_sh = AGOLTokenSecurityHandler(username, password)
                return agol_sh
            else:
                portal_sh = PortalTokenSecurityHandler(username, password, url)
                return portal_sh
        else:
            return None
    except Exception as e:
        send_msg("Unable to initialize security handler. {0}".format(str(e)), "error")
        return False

def initialize_featurelayer(layer_url, agol_sh):
    """ used to initialize the asset feature layer and user table """
    try:
        feature_layer = FeatureLayer(
            url=layer_url,
            securityHandler=agol_sh,
            initialize=True)
        return feature_layer
    except Exception as e:
        send_msg("Could not initialize asset layer. URL-{0} Error: {1}"\
                        .format(layer_url, str(e)), "error")
        return False

def convert_text_to_dict(text, label):
    """ return text as JSON dict.
        label can be 'widget config' or 'signup fields' """
    try:
        data = loads(text)
        return data
    except Exception as e:
        send_msg("Could not decode {0} Error: {1}".format(label, str(e)), "error")
        return False

def email_exists(input_email, check_token_validity=False):
    """ check if email exists in user table """
    # search case insensitive email
    where_clause = "UPPER({0})='{1}'".format(user_email_field, input_email.upper())
    rowcount = 0
    try:
        send_msg("user table {0}".format(user_table), "message")
        with arcpy.da.SearchCursor(in_table=user_table,
                                   field_names=[user_email_field, token_date_field],
                                   where_clause=where_clause) as cursor:
            send_msg("curose created {0}".format(user_table), "message")
            rowcount = len([i for i in cursor])

            # return true in signup case
            if check_token_validity is False:
                #pylint: disable=R0102
                # need to check if rowcount is exactly == 1
                if rowcount == 1:
                    return True
                else:
                    return False

            # check validity of token in login case
            # user may access app after token has expired
            if check_token_validity is True:
                if rowcount != 1:
                    # user does not exist
                    return False
                # reset cursor back to first row
                cursor.reset()
                for row in cursor:
                    token_time = row[1]
                    if token_time in [None, ""]:
                        raise Exception("No token date recorded to verify validity.")
                    delta = datetime.datetime.utcnow() - token_time
                    validity = timedelta(minutes=int(token_expiry_minutes))
                    isvalid = delta < validity
                    if isvalid or int(token_expiry_minutes) == 0:
                        # if expiration is set to 0  minutes, tokens never expire
                        return True
                    else:
                        # update token and send login email
                        update_usertoken(expired_email=input_email)
                        process_login(email_address=row[0])
                        send_msg("Regenerated usertoken")

    except Exception as e:
        send_msg("Error occurred while verifying if email exists. Error: {0}".format(str(e)),
                 "error")
        return None

def validate_url_token():
    """ verifies if the token is valid and returns email address """
    userid = "{"+url_userid+"}"
    usertoken = "{"+url_usertoken+"}"
    # get globalid fieldname
    desc = arcpy.Describe(user_table)
    globalid_field = desc.globalIDFieldName
    # match userid and usertoken pair
    where_clause = "{0}='{1}' AND {2}='{3}'".format(globalid_field, userid.upper(),
                                                    user_token_field, usertoken)
    rowcount = 0
    try:
        with arcpy.da.SearchCursor(in_table=user_table,
                                   field_names=[user_email_field, token_date_field],
                                   where_clause=where_clause) as cursor:

            rowcount = len([i for i in cursor])
            if rowcount == 0:
                send_msg("Userid and usertoken do not match.", "error")
                return
            elif rowcount == 1:
                # reset cursor back to first row
                cursor.reset()
                for row in cursor:
                    token_time = row[1]
                    if token_time in [None, ""]:
                        raise Exception("No token date recorded to verify validity.")
                    delta = datetime.datetime.utcnow() - token_time
                    validity = timedelta(minutes=int(token_expiry_minutes))
                    isvalid = delta < validity
                    if isvalid or int(token_expiry_minutes) == 0:
                        # return email address
                        # if expiration is set to 0  minutes, tokens never expire
                        emailid = {"email":str(row[0])}
                        send_msg(emailid, "success")
                        return True
                    else:
                        # update token
                        update_usertoken(expired_email=str(row[0]))
                        send_msg("Updating token for {0}".format(row[0]))
                        process_login(email_address=str(row[0]))
                        send_msg("Regenerated usertoken", "success")
            else:
                send_msg("Duplicate users in user table", "error")

    except Exception as e:
        send_msg("Could not validate user token. {0}".format(str(e)), "error")

def update_usertoken(expired_email=""):
    """ updates expired usertoken and tokendate """
    try:
        desc = arcpy.Describe(user_table)
        # is the table versioned?
        is_versioned = desc.isVersioned
        # get workspace
        wksp = desc.path
        # Start an edit session. Must provide the workspace.
        edit = arcpy.da.Editor(wksp)
        # start editing without undo/redo stack and without multiuser mode for non-versioned
        # and with multiuser mode for versioned table
        edit.startEditing(False, is_versioned)
        # Start an edit operation
        edit.startOperation()
        if action.lower() == "login":
            # find user by input email
            email_address = input_user_email
            where_clause = "UPPER(EMAIL)='{0}'".format(email_address.upper())
        elif action.lower() == "validate":
            # find user by expired email
            email_address = expired_email
            where_clause = "UPPER(EMAIL)='{0}'".format(email_address.upper())
        # update row for user
        with arcpy.da.UpdateCursor(in_table=user_table,
                                   field_names=[user_token_field, token_date_field],
                                   where_clause=where_clause) as cursor:
            for row in cursor:
                # add new guid
                row[0] = "{"+str(uuid4())+"}"
                # record current time
                row[1] = datetime.datetime.utcnow()
                cursor.updateRow(row)

        send_msg("User: {0} token regenerated".format(email_address))
        # return new userid-globalid and usertoken-guid
        userid, usertoken = get_userid_usertoken(email_address=email_address)
        # Stop the edit operation.
        edit.stopOperation()
        # Stop the edit session and save the changes
        edit.stopEditing(True)

        return userid, usertoken

    except Exception as e:
        send_msg("Error occurred while regenerating usertoken. Error: {0}".format(str(e)),
                 "error")
        if edit.isEditing:
            edit.stopEditing(False)
        return None, None

def validate_newuser_signupfields():
    """ check signup fields while adding new user """
    # get signup field value pairs
    in_fields = {}
    if len(signup_fields) > 0:
        in_fields = convert_text_to_dict(signup_fields, "signup fields")
    else:
        # no signup fields provided
        return in_fields

    # validate if fields exist in the database
    db_fields = arcpy.ListFields(user_table)
    for field in dict(in_fields):
        fldFound = False
        for db_field in db_fields:
            if db_field.name.upper() == field.upper():
                fldFound = True
                db_length = db_field.length
                if len(in_fields[field]) > db_length:
                    # remove if field length is smaller than input values
                    in_fields[field] = in_fields[field][:db_field.length]
                if db_field.name != field:
                    in_fields[db_field.name] = in_fields[field]
                    del in_fields[field]
        if fldFound == False:
            del in_fields[field]
                

    send_msg(in_fields)
    return in_fields
def checkFieldCase(fields):
    db_fields = arcpy.ListFields(user_table)
    for field in fields:
        fldFound = False
        for db_field in db_fields:
            if db_field.name.upper() == field.upper():
                fldFound = True
                
                if db_field.name != field:
                    fields[db_field.name] = fields[field]
                    del fields[field]
        if fldFound == False:
            del fields[field]
    return fields
    
def add_user():
    """ adds user to geodatabase using email and signup fields """
    fields = validate_newuser_signupfields()
    # add email field
    fields.update({user_email_field:input_user_email})
    # add token field and generate a new guid
    fields.update({user_token_field: "{"+str(uuid4())+"}"})
    # add current time when token was generated
    fields.update({token_date_field:datetime.datetime.utcnow()})
    fields = checkFieldCase(fields=fields)
    # check email field length
    try:
        table_fields = arcpy.ListFields(user_table)
        #table_fields = arcpy.Describe(user_table).fields
        email_field = []
        email_field = [field for field in table_fields if field.name.upper() == user_email_field.upper()]
        if len(email_field) == 0:
            raise Exception("Could not find email field in user table")
        if len(input_user_email) > email_field[0].length:
            send_msg("Email address too long. Only {0} characters allowed. Found {1}.".format( \
                     email_field[0].length, len(input_user_email)), "error")
            return None, None
    except Exception as e:
        send_msg("Error occurred while evaluating email field length. Error: {0}".format(str(e)),
                 "error")
        return None, None

    # insert row in geodatabase
    try:

        desc = arcpy.Describe(user_table)
        # is the table versioned?
        is_versioned = desc.isVersioned
        # get workspace
        wksp = desc.path
        # Start an edit session. Must provide the workspace.
        edit = arcpy.da.Editor(wksp)
        # start editing without undo/redo stack and without multiuser mode for non-versioned
        # and with multiuser mode for versioned table
        edit.startEditing(False, is_versioned)
        # Start an edit operation
        edit.startOperation()
        # insert row for new user
        with arcpy.da.InsertCursor(in_table=user_table,
                                   field_names=fields.keys()) as cursor:
            oid = cursor.insertRow(fields.values())
        send_msg("User: {0} added with oid: {1}".format(input_user_email, oid))
        # return userid-globalid and usertoken-guid
        userid, usertoken = get_userid_usertoken(input_user_email)
        # Stop the edit operation.
        edit.stopOperation()
        # Stop the edit session and save the changes
        edit.stopEditing(True)

        return userid, usertoken

    except Exception as e:
        send_msg("Error occurred while adding user to geodatabase. Error: {0}".format(str(e)),
                 "error")
        if edit.isEditing:
            edit.stopOperation()
            edit.stopEditing(False)
        return None, None

def get_base_appurl():
    """ returns base app url to honor appbuilder url parameters """
    if "?" in appurl:
        # honor existing appbuilder url parameters
        # use &
        base_appurl = "{0}&".format(appurl)
    else:
        # add url parameters as is
        # use ?
        base_appurl = "{0}?".format(appurl)
    return base_appurl

def generate_login_link(userid, usertoken):
    """ generates the login link to access the app """
    # todo: replace userid and usetoken if it already exists in appurl
    # generate appurl
    if len(adopted_assetid) > 0:
        # assign asset to user who tried to adopt before signing up or logging in
        template = "<a href={0}userid={1}&usertoken={2}&assign={3}>Login</a>"
        # userid-globalid should be converted to lowercase as it is written to
        # asset layer in a guid field which converts it to lowercase
        login_link = template.format(get_base_appurl(), userid.lower(), usertoken, adopted_assetid)
        return login_link
    else:
        template = "<a href={0}userid={1}&usertoken={2}>Login</a>"
        login_link = template.format(get_base_appurl(), userid.lower(), usertoken)
        return login_link

def prepare_signup_email(userid, usertoken):
    """ prepares the sign up email body """
    # read signup template
    body = open(signup_template, "r").read()
    # substitute the login link
    if '{{LoginLink}}' in body:
        login_link = generate_login_link(userid, usertoken)
        body = body.replace('{{LoginLink}}', login_link)
    else:
        send_msg("{{LoginLink}} keyword not found in email template.", "warning")

    return body

def get_asset_titlefields(asset_layer, wconfig):
    """ read widget configuration to get nicknamefield
    # read popup title parameter
    # read layer info to find display_field
    # read layer info to find objectid field
    # return dict of titlefields
    """
    # get popup title
    try:
        asset_titlefields = {}
        asset_titlefields["popupfields"] = []
        asset_titlefields["popuptitle"] = ''
        asset_titlefields["layername"] = asset_layer.name
        try:
            if len(asset_popup_config) > 0:
                popupfields = findall(r"\{(.*?)\}", asset_popup_config)
                asset_titlefields["popupfields"] = popupfields
                asset_titlefields["popuptitle"] = asset_popup_config
        except Exception as e:
            send_msg("Error in fetching configured popup title. Error: {0}".format(str(e)), "error")

        # these are always present
        asset_titlefields["nicknamefield"] = wconfig.get("nickNameField")
        asset_titlefields["displayfield"] = asset_layer.displayField
        asset_titlefields["objectidfield"] = asset_layer.objectIdField

        return asset_titlefields
    except Exception as e:
        send_msg("Error in fetching asset title fields. Error: {0}".format(str(e)), "error")
        return False

def get_asset_title(asset, asset_titlefields):
    """ return asset title using either nickname, popup title,
        display_field, layername:objectid in that order. """
    # get nickname of asset
    nickname = asset.get_value(asset_titlefields["nicknamefield"])
    if nickname != None and nickname != "":
        return nickname
    # get popup title of asset
    popup_title = asset_titlefields["popuptitle"]
    for field in asset_titlefields["popupfields"]:
        popup_title = popup_title.replace("{"+field+"}",
                                          "{0}".format(asset.get_value(field)))
        # strip empty field values
        popup_title = popup_title.replace("None", "")
    if popup_title != None and popup_title != '':
        return popup_title
    # get display field of asset layer
    display_field = asset.get_value(asset_titlefields["displayfield"])
    if display_field != None and display_field != '':
        return display_field
    # if all above are empty, then display layername:objectid
    asset_title = "{0}:{1}".format(asset_titlefields["layername"],\
                   asset.get_value(asset_titlefields["objectidfield"]))
    return asset_title


def prepare_html_table(assets, userid, usertoken, actions, asset_titlefields):
    """ prepares the html table of assets adopted by user with action links """
    if len(assets) == 0:
        return no_assets_message

    if len(assets) > 0:
        # start html table
        html_table = """<table style="border: 1px solid #ccc; border-collapse: collapse;" """ \
                     """ cellspacing="0" cellpadding="10">"""

        for asset in assets:
            asset_title = get_asset_title(asset, asset_titlefields)
            # add asset title table cell
            title_template = """<tr><td style="border: 1px solid #ccc; border-collapse: collapse;" """ \
                             """ cellspacing="0" cellpadding="10">{0}</td>"""
            html_table = html_table + title_template.format(asset_title)
            # add action link table cells
            # link_template indexes
            # 0 - app url
            # 1 - userid
            # 2 - usertoken
            # 3 - urlparam
            # 4 - objectid
            # 5 - action name
            link_template = """<td style="border: 1px solid #ccc; border-collapse: collapse;" """ \
                            """ cellspacing="0" cellpadding="10"> """ \
                            """<a href={0}userid={1}&usertoken={2}&{3}={4}>{5}</a></td>"""
            for actionitem in actions:
                # generate action links for each configured action
                actionlink = link_template.format( \
                                get_base_appurl(),
                                userid.lower(),
                                usertoken,
                                actionitem.get("urlparam"),
                                asset.get_value(asset_titlefields["objectidfield"]),
                                actionitem["name"])
                # add action link cells to table
                html_table = html_table + " " + actionlink
            # close the table row for this asset
            html_table = html_table + " </tr>"
        return html_table

def prepare_login_email(html_table, userid, usertoken):
    """ prepares the login email body """
    # read login template
    body = open(login_template, "r").read()

    # substitute the login link
    if '{{LoginLink}}' in body:
        login_link = generate_login_link(userid, usertoken)
        body = body.replace('{{LoginLink}}', login_link)
    else:
        send_msg("{{LoginLink}} keyword not found in email template.", "warning")

    # substitute the html table of adopted assets
    if '{{AdoptedAssets}}' in body:
        body = body.replace('{{AdoptedAssets}}', html_table)
    else:
        send_msg("{{AdoptedAssets}} keyword not found in email template.", "warning")

    return body


def get_configuredactions(wconfig):
    """ read configured actions from widget configuration """
    actions = []
    try:
        for actionitem in wconfig["actions"]["additionalActions"]:
            actions.append({"name":actionitem["name"], "urlparam":actionitem["urlParameterLabel"]})
        # always add the abandon action at the end
        actions.append({"name":wconfig["actions"]["unAssign"]["name"],
                        "urlparam":wconfig["actions"]["unAssign"]["urlParameterLabel"]})
        return actions
    except Exception as e:
        send_msg("Error reading configured actions. {0}".format(str(e)), "error")


def get_userid_usertoken(email_address=input_user_email):
    """ returns userid, usertoken of existing user """
    try:
        desc = arcpy.Describe(user_table)
        globalid_field = desc.globalIDFieldName
        where_clause = "UPPER({0})='{1}'".format(user_email_field, email_address.upper())
        with arcpy.da.SearchCursor(in_table=user_table,
                                   where_clause=where_clause,
                                   field_names=[globalid_field, user_token_field]) \
                                   as cursor:
            for row in cursor:
                # return globalid and usertoken
                # remove curly braces from the guids
                userid = str(row[0])[1:-1].lower()
                usertoken = str(row[1])[1:-1].lower()
                return userid, usertoken
    except Exception as e:
        send_msg("Error while fetching userid and usertoken. Error: {0}".format(str(e)), "error")
        return None, None

def get_adopted_assets(asset_layer, userid, wconfig, asset_titlefields):
    """ returns ArcREST featureset of assets adopted by user """
    try:
        key_field = wconfig.get("foreignKeyFieldForUserTable")
        fields = [asset_titlefields["nicknamefield"],
                  asset_titlefields["displayfield"],
                  asset_titlefields["objectidfield"],
                  key_field]
        fields.extend(asset_titlefields["popupfields"])
        # get unique set of fields
        out_fields = ",".join(set(fields))
        # globalid fields are stored in uppercase
        userid = userid.upper()
        where_clause = "{0}='{1}'".format(key_field, userid)
        assets = asset_layer.query(where=where_clause,
                                   out_fields=out_fields,
                                   returnGeometry=False).features
        if len(assets) == 0:
            send_msg("No assets adopted by user")
        return assets
    except Exception as e:
        send_msg("Error in getting assets adopted by user. Error: {0}".format(str(e)), "error")
        return None

def send_email(email_body, email_address):
    """ send emails to adopters """
    msg = MIMEMultipart()
    msg['From'] = from_address
    msg['To'] = email_address
    if action.lower() == "signup":
        msg['Subject'] = signup_email_subject
    if action.lower() in ["login", "validate"]:
        msg['Subject'] = login_email_subject
    # Attach the email body
    msg.attach(MIMEText(email_body, 'html'))
    try:
        server = SMTP(smtp_server)

        if use_tls:
            server.starttls()
        server.ehlo()
        if smtp_username != "" and smtp_password != "":
            server.esmtp_features['auth'] = 'LOGIN'
            server.login(smtp_username, smtp_password)

        # send email to all adopters
        messagebody = msg.as_string()
        send_msg("Sending email to {0}".format(email_address))
        server.sendmail(from_address, email_address, messagebody)
        server.quit()
        return True

    except Exception as e:
        send_msg("Failure in sending email. {0}".format(str(e)), "error")
        return False

def process_signup():
    """ process signup operation """
    email_status = email_exists(input_email=input_user_email, check_token_validity=False)
    if email_status is True:
        send_msg("Email already exists.", "error")
        return
    elif email_status is False:
        # add user to database
        userid, usertoken = add_user()
        if userid is None and usertoken is None:
            return
        email_body = prepare_signup_email(userid, usertoken)
        if send_email(email_body, input_user_email):
            send_msg("Sent email", "success")
        else:
            return
    else:
        # an error occurred while verifying if email exists
        send_msg("Error occurred while verifying if email exists.", "error")
        return

def process_login(email_address):
    """ process login operation """
    # verify if email exists
    email_status = email_exists(input_email=email_address, check_token_validity=True)
    if email_status is True:
        pass # continue further
    elif email_status is False:
        send_msg("User does not exist", "error")
        return
    elif email_status is None:
        return
    # initialize AGOL/Portal security handler
    agol_sh = initialize_securityhandler(assetlyr_portalurl,
                                         assetlyr_username,
                                         assetlyr_password)
    if agol_sh is False:
        return

    # initialize user table
    asset_layer = initialize_featurelayer(layer_url=assetlyr_url,
                                          agol_sh=agol_sh)
    if not asset_layer:
        return

    # get widget config
    wconfig = convert_text_to_dict(widget_config, "widget config")
    if not wconfig:
        send_msg("No widget configuration supplied", "error")
        return

    # get userid, usertoken
    userid, usertoken = get_userid_usertoken(email_address)
    # get configured fields for asset title
    asset_titlefields = get_asset_titlefields(asset_layer, wconfig)
    if not asset_titlefields:
        return
    # get adopted asset features
    assets = get_adopted_assets(asset_layer, userid, wconfig, asset_titlefields)
    # get configured actions
    actions = get_configuredactions(wconfig)
    # prepare html table containing adopted assets with action links
    html_table = prepare_html_table(assets, userid, usertoken, actions, asset_titlefields)
    # prepare the email body using login template
    email_body = prepare_login_email(html_table, userid, usertoken)
    # send the login email
    if send_email(email_body, email_address):
        send_msg("Sent email", "success")

def return_unique_teamnames():
    """ return unique team names """
    # out message format
    team_result = {"teamfield":{}, "features":[]}
    # if no team field configured, send empty response
    if len(user_team_field) == 0:
        team_result["teamfield"] = None
        send_msg(team_result, "success")
        return
    # if team field configured, send unique names
    if len(user_team_field) > 0:
        try:
            desc = arcpy.Describe(user_table)
            field_info = [f for f in arcpy.ListFields(user_table) if f.name == user_team_field][0]
            # generate team field properties info
            team_result["teamfield"] = {"name":str(field_info.name),
                                        "type": str(field_info.type),
                                        "alias": str(field_info.aliasName),
                                        "length": str(field_info.length),
                                        "nullable": str(field_info.isNullable),
                                        "default": str(field_info.defaultValue)
                                       }
            # find unique names in team field
            rowcount = 0
            with arcpy.da.SearchCursor(in_table=user_table, field_names=user_team_field,
                                       sql_clause=["DISTINCT", None]) as cursor:

                rowcount = len([i for i in cursor])
                if rowcount == 0:
                    team_result["features"] = []
                    send_msg(team_result, "success")
                if rowcount > 0:
                    # reset cursor
                    cursor.reset()
                    for row in cursor:
                        if row[0] is not None:
                            team_result["features"].append(
                                {"attributes":{str(user_team_field): str(row[0])}})

                # return team result
                send_msg(team_result, "success")
        except Exception as e:
            send_msg("Error getting team names. {0}".format(str(e)), "error")

def validate_inputs():
    """ validate input parameters """
    if not arcpy.Exists(user_table):
        send_msg("Could not connect to user table at {0}".format(str(user_table)), "error")
        return False

    if action.lower() in ["signup", "login"]:
        if len(input_user_email) == 0:
            # no user email provided
            send_msg("Email address required", "error")
            return False
        # validate email address format
        elif not match(r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]" \
                       r"{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}" \
                       r"[a-zA-Z0-9])?)*$", input_user_email):
            send_msg("Invalid email address format. {0}".format(input_user_email), "error")
            return False
        elif action.lower() == "login" and len(widget_config) == 0:
            send_msg("No widget configuration supplied", "error")
            return False
        else:
            return True

    if action.lower() == "validate":
        if len(url_userid) > 1 and len(url_usertoken) > 1:
            # validate guid patterns
            uuid_pattern = r"^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB]" \
                           r"[0-9A-F]{3}-[0-9A-F]{12}$"
            if not (match(uuid_pattern, url_userid, IGNORECASE) and
                    match(uuid_pattern, url_usertoken, IGNORECASE)):
                send_msg("Invalid userid or usertoken", "error")
                return False
            # check if widget config is provided
            elif len(widget_config) == 0:
                send_msg("No widget configuration supplied", "error")
                return False
            else:
                return True

    if action.lower() == "teams":
        # nothing to validate
        return True

def main():
    """ main function """
    # validate inputs for actions
    if not validate_inputs():
        return

    # validate user table schema
    if not validate_user_table():
        return

    # return unique team names
    if action.lower() == "teams":
        return_unique_teamnames()

    # validate if user exists and token is valid
    if action.lower() == "validate":
        validate_url_token()

    # add user and send signup email if action=signup
    if action.lower() == "signup":
        process_signup()

    if action.lower() == "login":
        process_login(email_address=input_user_email)


if __name__ == '__main__':
    main()

