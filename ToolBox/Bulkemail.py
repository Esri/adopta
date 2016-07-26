# pylint: disable=C0103,W0703,E1101
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

from __future__ import print_function, unicode_literals, absolute_import
from re import findall
from uuid import uuid4
from ast import literal_eval
import datetime
from datetime import timedelta
try:
    # python 2
    import urlparse
except ImportError:
    # python 3
    import urllib.parse as urlparse
from arcrest import web
from arcrest.security import AGOLTokenSecurityHandler
from arcrest.security import PortalTokenSecurityHandler
from arcrest.agol import FeatureLayer
from arcrest.common.geometry import Polygon
from arcrest.common.filters import GeometryFilter
import arcpy
import send_email
#------------------------------------------------------------------------------#

# read tool input parameters
aoi = arcpy.GetParameter(0)
user_table = arcpy.GetParameterAsText(1)
user_email_field = arcpy.GetParameterAsText(2)
user_token_field = arcpy.GetParameterAsText(3)
token_date_field = arcpy.GetParameterAsText(4)
token_expiry_minutes = arcpy.GetParameterAsText(5)
assetlayer_url = arcpy.GetParameterAsText(6)
assetlyr_portalurl = arcpy.GetParameterAsText(7)
assetlyr_username = arcpy.GetParameterAsText(8)
assetlyr_password = arcpy.GetParameterAsText(9)
appurl = arcpy.GetParameterAsText(10)
smtp_server = arcpy.GetParameterAsText(11)
smtp_username = arcpy.GetParameterAsText(12)
smtp_password = arcpy.GetParameterAsText(13)
use_tls = arcpy.GetParameterAsText(14)
from_address = arcpy.GetParameterAsText(15)
email_subject = arcpy.GetParameterAsText(16)
email_template = arcpy.GetParameterAsText(17)
test_mode = arcpy.GetParameterAsText(18)
test_login_email = arcpy.GetParameterAsText(19)

def send_msg(message, messagetype="message"):
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
        arcpy.SetParameterAsText(20, ("Failed. " + message))
    if messagetype.lower() == "success":
        # set the result_output parameter in case of success
        arcpy.AddMessage("Success. " + message)
        arcpy.SetParameterAsText(20, ("Success. " + message))

    print (message)

def validate_inputs():
    """ validate and initialize user table """
    # this check is not required on server after publishing as gp service
    if arcpy.ProductInfo() != "ArcServer":
        desc = arcpy.Describe(user_table)
        # check if user table has globalid enabled
        if not desc.hasGlobalID:
            send_msg("User table does not have globalids enabled.", "error")
            return False

        # check if user table is an enterprise gdb
        workspace_props = arcpy.Describe(desc.path)
        if workspace_props.workspaceFactoryProgID not in ["esriDataSourcesGDB.SdeWorkspaceFactory.1",
                                                          "esriDataSourcesGDB.SdeWorkspaceFactory"] :
            send_msg("User table must be sourced from an enterprise geodatabase", "error")
            return False

    # check if test login email exists
    if test_mode == "true":
        send_msg("="*30)
        send_msg("TEST MODE")
        send_msg("-"*30)
        whereclause = "UPPER({0})='{1}'".format(user_email_field, test_login_email.upper())
        rowcount = 0
        with arcpy.da.SearchCursor(in_table=user_table, field_names=[user_email_field],
                                   where_clause=whereclause) as cursor:
            rowcount = len([i for i in cursor])
            if rowcount == 0:
                send_msg("Test login email does not exist.", "error")
                return False
            elif rowcount == 1:
                return True
    else:
        return True

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
    """ used to initialize the asset feature layer """
    try:
        feature_layer = FeatureLayer(
            url=layer_url,
            securityHandler=agol_sh,
            initialize=True)
        return feature_layer
    except Exception as e:
        send_msg("Could not initialize layer. URL-{0} {1}"\
                        .format(layer_url, str(e)), "error")
        return False

def get_widgetconfig():
    """ get widget's configuration to read action links """
    try:
        # generate url to widget configuration file from hosted appURL
        path_to_hostedapp = clean_app_url()
        path_to_widgetconfig = ("{0}/configs/Adopta/config_Adopta.json".format(path_to_hostedapp))
        # fetch widget's configuration json
        try:
            baseweboperation = web._base.BaseWebOperations()
            wconfig = baseweboperation._get(url=path_to_widgetconfig)
        except:
            # use default widget configuration
            path_to_widgetconfig = ("{0}/widgets/Adopta/config.json".format(path_to_hostedapp))
            baseweboperation = web._base.BaseWebOperations()
            wconfig = baseweboperation._get(url=path_to_widgetconfig)

        return wconfig

    except Exception as e:
        send_msg("Could not fetch widget configuration. {0}".format(str(e)), "error")
        return False

def clean_app_url():
    """return base url to hosted app"""
    result = urlparse.urlsplit(url=appurl)
    baseurl = "{0}://{1}".format(result.scheme, result.netloc)
    path_to_hostedapp = urlparse.urljoin(baseurl, result.path)
    if path_to_hostedapp[-1:] == "/":
        path_to_hostedapp = path_to_hostedapp[:-1]
    return path_to_hostedapp

def build_geometryfilter(geometry):
    """ builds and returns arcrest geometryfilter """
    if geometry is None:
        return None
    try:
        if isinstance(geometry[0], arcpy.Polygon):
            rings = literal_eval(geometry[0].JSON)["rings"]
            # get spatial reference wkid
            wkid = literal_eval(geometry[0].JSON)["spatialReference"]["wkid"]
            filter_poly = Polygon(rings, wkid)
            return GeometryFilter(filter_poly).filter
        else:
            return None
    except Exception as e:
        send_msg("Unable to build query geometry. {0}".format(str(e)), "error")
        return None

def get_assetoids(aoi_layer, asset_layer, wconfig):
    """ get all adopted assets in aoi """
    # pylint: disable=E1101
    try:
        geom_filter = None
        # get the relationship key field in asset layer
        relate_keyfield = wconfig["foreignKeyFieldForUserTable"]
        # get only assets that have been adopted
        where_clause = "{0} is not Null".format(relate_keyfield)
        # prepare aoi geometry
        if int(arcpy.GetCount_management(aoi_layer)[0]) > 0:
            aoi_features = []
            for row in arcpy.da.SearchCursor(aoi_layer, ["SHAPE@"]):
                aoi_features.append(row[0])
            if len(aoi_features) == 1:
                # if only one feature drawn
                geom_filter = build_geometryfilter([aoi_features][0])
            elif len(aoi_features) > 1:
                # if layer provided in pro
                # dissolve all features to create one feature
                try:
                    diss_geom = arcpy.Dissolve_management(aoi_layer, arcpy.Geometry())
                    geom_filter = build_geometryfilter(diss_geom)
                except Exception as e:
                    send_msg("Could not dissolve aoi features. {0}".format(str(e)), "error")

        # get all adopted assets oids
        asset_oids = asset_layer.query(where=where_clause,
                                       geomtryFilter=geom_filter,
                                       returnIDsOnly=True)
        send_msg("Adopted assets: {0}".format(len(asset_oids["objectIds"])))
        if len(asset_oids["objectIds"]) == 0:
            return False
        else:
            return asset_oids["objectIds"]

    except Exception as e:
        send_msg("Unable to get adopted asset oids. {0}".format(str(e)), "error")

def get_asset_titlefields(wconfig, asset_layer):
    """ read widget configuration to get nicknamefield
    # read webmap to find configured popup title
    # read layer info to find display_field
    # read layer info to find objectid field
    """

    # get popup title from webmap
    try:
        asset_titlefields = {}
        asset_titlefields["popupfields"] = []
        asset_titlefields["popuptitle"] = ''
        asset_titlefields["layername"] = asset_layer.name
        path_to_hostedapp = clean_app_url()
        path_to_appconfig = ("{0}/config.json".format(path_to_hostedapp))
        try:
            # fetch app's configuration json
            baseweboperation = web._base.BaseWebOperations()
            appconfig = baseweboperation._get(url=path_to_appconfig)
            webmapid = appconfig["map"]["itemId"]
            portalurl = appconfig["map"]["portalUrl"]
            webmapdataurl = "{0}/sharing/rest/content/items/{1}/data?f=json"\
                            .format(portalurl, webmapid)
            webmapdata = baseweboperation._get(url=webmapdataurl)
            for oplayer in webmapdata["operationalLayers"]:
                if oplayer["url"] == assetlayer_url:
                    if "popupInfo" in oplayer:
                        popuptitle = oplayer["popupInfo"]["title"]
                        popupfields = findall(r"\{(.*?)\}", popuptitle)
                        asset_titlefields["popupfields"] = popupfields
                        asset_titlefields["popuptitle"] = popuptitle
        except Exception as e:
            send_msg("Error in fetching configured popup title. {0}".format(str(e)), "error")
            return asset_titlefields

        # these are always present
        asset_titlefields["nicknamefield"] = wconfig["nickNameField"]
        asset_titlefields["displayfield"] = asset_layer.displayField
        asset_titlefields["objectidfield"] = asset_layer.objectIdField

        return asset_titlefields
    except Exception as e:
        send_msg("Error in fetching asset title fields. Error: {0}".format(str(e)), "error")
        return False


def chunklist(l, n):
    """Yield successive n-sized chunks from l. """
    n = max(1, n)
    for i in range(0, len(l), n):
        yield l[i:i+n]

def get_adopted_assets(asset_oids, asset_layer, asset_titlefields, wconfig):
    """ get asset details in chunks of 100 """
    chunks = chunklist(asset_oids, 100)
    asset_features = []
    fields = [asset_titlefields["nicknamefield"],
              asset_titlefields["displayfield"],
              asset_titlefields["objectidfield"],
              wconfig.get("foreignKeyFieldForUserTable")]
    fields.extend(asset_titlefields["popupfields"])
    # get unique set of fields
    out_fields = ",".join(set(fields))
    # get asset features in chunks of 100
    try:
        for chunk in chunks:
            oids = ",".join(str(x) for x in chunk)
            features = asset_layer.query(objectIds=oids, out_fields=out_fields,
                                         returnGeometry=False)
            asset_features.extend(features)
        return asset_features
    except Exception as e:
        send_msg("Error in getting asset details. {0}".format(str(e)), "error")
        return asset_features

def aggregate_adoptions(assets, wconfig):
    """ aggregate user's email, userid, usertoken, assets in an object """
    # build unique set of userids from all assets
    asset_guids = set()
    for asset in assets:
        asset_guids.add(asset.get_value(wconfig["foreignKeyFieldForUserTable"]))
    send_msg("No of adopters: {0}".format(len(asset_guids)))
    users = []
    try:
        globalid_field = arcpy.Describe(user_table).globalIDFieldName
        orphan_assets = []
        for guid in asset_guids:
            user_guid = "{"+guid+"}"
            # globalids are stored in uppercase
            whereclause = "{0}='{1}'".format(globalid_field, user_guid.upper())
            rowcount = 0
            with arcpy.da.SearchCursor(in_table=user_table,
                                       field_names=[user_email_field, user_token_field],
                                       where_clause=whereclause) as cursor:

                rowcount = len([i for i in cursor])
                if rowcount == 0:
                    # orphan asset (guid present in asset, but corresponding owner not found)
                    orphan_assets.append(user_guid)
                    send_msg("Asset adopted {0}, but user not found in table".format(user_guid))

                # reset cursor back to first row
                cursor.reset()
                for row in cursor:
                    # remove curly braces from token guid
                    usertoken = row[1][1:-1]
                    # aggregate assets for each user
                    assets_of_user = []
                    for asset in assets:
                        asset_guid = asset.get_value(wconfig["foreignKeyFieldForUserTable"])
                        if user_guid[1:-1] == asset_guid:
                            assets_of_user.append(asset)
                    # add user's email, userid, usertoken, assets in an object
                    users.append({"email": str(row[0]),
                                  "user_guid": guid,
                                  "user_token": usertoken,
                                  "assets": assets_of_user})
        # if none of the assets found owners, then probably incorrect usertable or assetlayer is used
        if len(orphan_assets) == len(asset_guids):
            send_msg("Incorrect usertable or asset layer. None of the assets have owners.", "error")
        return users, orphan_assets
    except Exception as e:
        send_msg("Unable to aggregate user emails. Error: {0}".format(str(e)), "error")

def print_adoptions_summary(adoptions, orphan_assets=None, verbose=True):
    """ print adoption statistics """
    if orphan_assets is None:
        orphan_assets = []
    numberof_users = int(arcpy.GetCount_management(user_table)[0])
    send_msg("="*30)
    send_msg("Adoption summary statistics")
    send_msg("-"*30)
    send_msg("Total registered users: {0}".format(numberof_users))
    send_msg("Users with adoptions: {0}".format(len(adoptions)))
    send_msg("Users without adoptions: {0}".format(numberof_users-len(adoptions)))
    send_msg("Orphans (adopted but owner not found): {0}".format(len(orphan_assets)))
    send_msg("="*30)
    send_msg("{0} email(s) will be sent.".format(len(adoptions)))
    send_msg("="*30)
    if verbose and len(adoptions) > 0:
        send_msg("Adoptions per user")
        send_msg("-"*30)
        for adopter in adoptions:
            send_msg("{0}: {1}".format(adopter["email"], len(adopter["assets"])))
        send_msg("="*30)

def get_configuredactions(wconfig):
    """ read configured actions from widget configuration """
    actions = []
    try:
        for action in wconfig["actions"]["additionalActions"]:
            actions.append({"name":action["name"], "urlparam":action["urlParameterLabel"]})
        # always add the abandon action at the end
        actions.append({"name":wconfig["actions"]["unAssign"]["name"],
                        "urlparam":wconfig["actions"]["unAssign"]["urlParameterLabel"]})
        return actions
    except Exception as e:
        send_msg("Error reading configured actions. Error: {0}".format(str(e)), "error")

def validate_usertoken(user):
    """ validate usertoken and update if expired """
    userid = user["user_guid"]
    usertoken = user["user_token"]
    # get globalid fieldname
    desc = arcpy.Describe(user_table)
    globalid_field = desc.globalIDFieldName
    # match userid and usertoken pair
    where_clause = "{0}='{1}' AND {2}='{3}'".format(globalid_field, "{"+userid.upper()+"}",
                                                    user_token_field, "{"+usertoken+"}")
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
                        # if expiration is set to 0  minutes, tokens never expire
                        return usertoken
                    else:
                        # update token
                        newtoken = update_usertoken(str(row[0]))
                        send_msg("Updated token for {0}".format(str(row[0])))
                        return newtoken
            else:
                send_msg("Duplicate users in user table", "error")
                # returns usertoken as is
                return usertoken

    except Exception as e:
        send_msg("Could not validate user token. {0}".format(str(e)), "error")
        # returns usertoken as is
        return user["user_token"]


def get_user_oids(featurelayer):
    """ get registered users from user table """
    try:
        oids = featurelayer.query(where="1=1", returnIDsOnly=True)
        return oids["objectIds"]
    except Exception as e:
        send_msg("Error in fetching oids from user table - {0} Error: {1}"\
                    .format(featurelayer.name, str(e)), "error")
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

def prepare_actionlinks(adopter, actions, asset_titlefields):
    """ Prepare html table of adopted assets """
    # start html table
    html_table = """<table style="border: 1px solid #ccc; border-collapse: collapse;" """\
                 """ cellspacing="0" cellpadding="10">"""
    # add row in html table for each asset
    for asset in adopter["assets"]:
        asset_title = get_asset_title(asset, asset_titlefields)
        # add asset title table cell
        title_template = """<tr> <td style="border: 1px solid #ccc; border-collapse: collapse;" """\
                         """ cellspacing="0" cellpadding="10">{0}</td>"""
        html_table = html_table + title_template.format(asset_title)
        # link_template indexes
        # 0 - app url
        # 1 - userid
        # 2 - usertoken
        # 3 - urlparam
        # 4 - objectid
        # 5 - action name
        link_template = """<td style="border: 1px solid #ccc; border-collapse: collapse;" """ \
                        """ cellspacing="0" cellpadding="10">""" \
                        """ <a href={0}?userid={1}&usertoken={2}&{3}={4}>{5}</a></td>"""
        for action in actions:
            # generate action links for each configured action
            actionlink = link_template.format( \
                            clean_app_url(),
                            adopter["user_guid"],
                            adopter["user_token"],
                            action["urlparam"],
                            asset.get_value(asset_titlefields["objectidfield"]),
                            action["name"])
            # add action link cells to table
            html_table = html_table + actionlink
        # close the table row for this asset
        html_table = html_table + "</tr>"
    return html_table

def prepare_emailbody(user, action_links):
    """ read the html template and substitute login link and action links """
    body = open(email_template, "r").read()
    # substitute the login link
    if '{{LoginLink}}' in body:
        body = body.replace('{{LoginLink}}',
                            "{0}?userid={1}&usertoken={2}".format( \
                            clean_app_url(),
                            user["user_guid"],
                            user["user_token"]))
    else:
        send_msg("{{LoginLink}} keyword not found in email template.", "error")
    # substitute the list of adopted assets
    if '{{AdoptedAssets}}' in body:
        body = body.replace('{{AdoptedAssets}}', action_links)
    else:
        send_msg("{{AdoptedAssets}} keyword not found in email template", "error")
    return body

def get_usertoken(email_address=None):
    """ returns usertoken of existing user """
    try:
        where_clause = "UPPER({0})='{1}'".format(user_email_field, email_address.upper())
        with arcpy.da.SearchCursor(in_table=user_table,
                                   where_clause=where_clause,
                                   field_names=[user_token_field]) \
                                   as cursor:
            for row in cursor:
                # return usertoken
                # remove curly braces from the guid
                usertoken = str(row[0])[1:-1].lower()
                return usertoken
    except Exception as e:
        send_msg("Error while fetching userid and usertoken. Error: {0}".format(str(e)), "error")
        return None

def update_usertoken(email_address=""):
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

        # return new usertoken-guid
        usertoken = get_usertoken(email_address=email_address)
        # Stop the edit operation.
        edit.stopOperation()
        # Stop the edit session and save the changes
        edit.stopEditing(True)

        return usertoken

    except Exception as e:
        send_msg("Error occurred while regenerating usertoken. Error: {0}".format(str(e)),
                 "error")
        if edit.isEditing:
            edit.stopEditing(False)
        return None

def main():
    """ main function """
    # validate inputs
    if not validate_inputs():
        return

    # initialize AGOL/Portal security handler
    agol_sh = initialize_securityhandler(assetlyr_portalurl,
                                         assetlyr_username,
                                         assetlyr_password)
    if agol_sh is False:
        return

    # initialize asset layer
    asset_layer = initialize_featurelayer(layer_url=assetlayer_url,
                                          agol_sh=agol_sh)
    if not asset_layer:
        return

    # get widget configuration
    wconfig = get_widgetconfig()
    if not wconfig:
        return

    # get adopted asset oids, use aoi polygon if drawn
    # if no aoi drawn, select all adopted assets
    asset_oids = get_assetoids(aoi, asset_layer, wconfig)
    if not asset_oids:
        send_msg("No adopted assets", "success")
        return


    # get configured fields for asset title
    asset_titlefields = get_asset_titlefields(wconfig, asset_layer)
    if not asset_titlefields:
        return

    # get adopted asset details in chunks of 100
    assets = get_adopted_assets(asset_oids, asset_layer, asset_titlefields, wconfig)
    if len(assets) == 0:
        send_msg("No adopted assets", "success")
        return

    # aggregate users, token, email, assets
    users, orphan_assets = aggregate_adoptions(assets, wconfig)

    # print adoption stats summary
    print_adoptions_summary(users, orphan_assets)

    # get configured action URL parameter names
    actions = get_configuredactions(wconfig)

    # send email to adopters
    sent = []
    for user in users:
        # test mode
        if test_mode == "true":
            if test_login_email.lower() not in [x["email"].lower() for x in users]:
                #test user does not have adoptions
                send_msg("Test user email does not have any adopted assets. No email sent.", "Success")
                return
            # process the test user
            if user["email"].upper() == test_login_email.upper():
                if int(token_expiry_minutes) != 0:
                    # if expiration is set to 0  minutes, tokens never expire
                    # validate/update token only for test user
                    user["user_token"] = validate_usertoken(user)
                # prepare html table of action links
                action_links = prepare_actionlinks(user, actions, asset_titlefields)
                # prepare email body
                email_body = prepare_emailbody(user, action_links)
                try:
                    send_email.send(email_subject, email_body, from_address, smtp_server, smtp_username, smtp_password, use_tls, [user["email"]])
                    sent.append(user["email"])
                except Exception as e:
                    send_msg("Failure in sending email. {0}".format(str(e)), "error")
                
        if test_mode == "false":
            # send email only to all users
            if int(token_expiry_minutes) != 0:
                # if expiration is set to 0  minutes, tokens never expire
                # validate/update tokens
                user["user_token"] = validate_usertoken(user)
            # prepare html table of action links
            action_links = prepare_actionlinks(user, actions, asset_titlefields)
            # prepare email body
            email_body = prepare_emailbody(user, action_links)
            try:
                send_email.send(subject, email_body, from_address, smtp_server, smtp_username, smtp_password, use_tls, [user["email"]])
                sent.append(user["email"])
            except Exception as e:
                send_msg("Failure in sending email. {0}".format(str(e)), "error")

    # set output result parameter
    if len(sent) > 0:
        send_msg("Successfully sent {0} email(s).".format(len(sent)), "Success")
    elif test_mode == "false" and len(users) > 0 and len(sent) == 0:
        send_msg("Unknown error occurred. No emails sent.", "Success")

if __name__ == '__main__':
    main()





