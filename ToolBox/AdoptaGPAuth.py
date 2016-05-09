# coding: utf-8
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
# Name:        Adopta GP Authentication
# Purpose:     This script takes the following inputs:
#               -----user provided:
#                       1. toemail: The toemail id to which mail is to be sent.
#                       2. action: To determine if the user is logging in or
#                                  signing up
#                       3. appurl: Contains the url of the application along
#                                  with the userid and assetid
#                       4. adoptedassets: Html table containing the links
#                                         to the adopted assets
#               -----constants:
#                       1.fromemail: The email from which the email which be
#                                    sent.
#                       2. signuptemplate: The html template containing the
#                                          email body. Used when action is
#                                          'signup'.
#                       3. logintemplate: The html template containing the email
#                                       body. Used when action is 'login'
#                       4.smtppassword: SMTP user password
#                       5.smtpusername: SMTP user name
#                       6.subjectline: Contains the subject line of the email
#                       7.smtpserver:  Contains the configured SMTP server
#                                      information
#                       8.usetls:      Boolean parameter which checks if to use
#                                      TLS.
#             The constants are preconfigured and set as constant value while
#             publishing the geoprocessing service.
#             The script takes the input, incorporates the HTML template in the
#             email, appends the appurl provided by user amd sends the email to
#             the provided email id.
#-------------------------------------------------------------------------------

#---------------------- Necessary Modules--------------------------------------#
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from smtplib import SMTP
import arcpy
#------------------------------------------------------------------------------#

def send_email(emailtemplate, emailconfiginfo):
    """ This method takes file template for email body and url as input, formats
        the text and sends the email.  """
    error = ''
    msg = MIMEMultipart()
    msg['From'] = emailconfiginfo['fromemail']
    msg['To'] = emailconfiginfo['toemail']
    msg['Subject'] = emailconfiginfo['subjectline']
    # Open the input html file and read the html content.
    files = open(emailtemplate, "r")
    body = files.read()

    if '{{LoginLink}}' in body:
        body = body.replace('{{LoginLink}}',
                            "<a href={0}>Login</a>".format(emailconfiginfo['appurl']))
    if '{{AdoptedAssets}}' in body:
        body = body.replace('{{AdoptedAssets}}',
                            emailconfiginfo['adoptedassets'])

    # Attaching the email body
    msg.attach(MIMEText(body, 'html'))

    try:
        server = SMTP(emailconfiginfo['smtpserver'])

        if emailconfiginfo['usetls']:
            server.starttls()
        server.ehlo()
        if emailconfiginfo['smtppassword'] != '' and \
            emailconfiginfo['smtpusername'] != '':

            server.esmtp_features['auth'] = 'LOGIN'
            server.login(emailconfiginfo['smtpusername'],
                         emailconfiginfo['smtppassword'])

        text = msg.as_string()
        server.sendmail(emailconfiginfo['fromemail'],
                        emailconfiginfo['toemail'], text)
        server.quit()

    except Exception as error:
        message = ''
        # When incorrect SMTP server address is provided an error message
        #'[Errno 11004] getaddrinfo failed' is returned. To capture this error
        # make it more readable for users we replace the error message
        # Please check provided SMTP server information.

        if 'getaddrinfo' in str(error):
            message = 'Failed. Please check provided SMTP server information.'

        # To capture certain SMTP error messages for example:
        # (530, '5.7.0 Must issue a STARTTLS command first. m184sm23086716pfb.22
        # - gsmtp')  and format them into user readable messages

        elif '.' in str(error):
            message = str(error).split('.')[2][1:]

        # If the error messages does not get captured by the above two
        # conditions then pass the message as-it-is
        else:
            message = str(error)

        arcpy.AddError("Failed." + message)
        arcpy.SetParameterAsText(12, ("Failed." + message))

def main():
    """ main function """
    error = ''
    #input parameters
    toemail = arcpy.GetParameterAsText(1)
    action = arcpy.GetParameterAsText(3)
    appurl = arcpy.GetParameterAsText(6)
    adoptedassets = arcpy.GetParameterAsText(7)

    #constants
    fromemail = arcpy.GetParameterAsText(0)
    subjectline = arcpy.GetParameterAsText(2)
    signuptemplate = arcpy.GetParameterAsText(4)
    logintemplate = arcpy.GetParameterAsText(5)
    smtpserver = arcpy.GetParameterAsText(8)
    smtpusername = arcpy.GetParameterAsText(9)
    smtppassword = arcpy.GetParameterAsText(10)
    usetls = arcpy.GetParameterAsText(11)

    emailconfiginfo = {}
    emailconfiginfo['appurl'] = appurl
    emailconfiginfo['fromemail'] = fromemail
    emailconfiginfo['toemail'] = toemail
    emailconfiginfo['subjectline'] = subjectline
    emailconfiginfo['adoptedassets'] = adoptedassets
    emailconfiginfo['smtpserver'] = smtpserver
    emailconfiginfo['smtpusername'] = smtpusername
    emailconfiginfo['smtppassword'] = smtppassword
    emailconfiginfo['usetls'] = usetls

    try:
        # Validate toemail value is provided
        if toemail is None or toemail == '':
            arcpy.AddError('To address can not be blank. \
                           Please provide To address.')
            arcpy.SetParameterAsText(12, 'Failed')
            return

        # Validate appurl is sent by the app.
        if appurl is None or appurl == '':
            arcpy.AddError('App URL cannot be blank. Please provide app URL.')
            arcpy.SetParameterAsText(12, 'Failed')
            return

        #Send email
        if action.upper() == 'LOGIN':
            # Check if value for adoptedassets is provided. This parameter
            # cannot be blank when action is Login.
            if adoptedassets == '' or adoptedassets is None:
                arcpy.AddError('Adopted assets can not be blank during login.' +
                               'Please provide Adopted assets value.')
                arcpy.SetParameterAsText(12, 'Failed')
                return
            else:

                send_email(logintemplate, emailconfiginfo)
                #Set the output parameter
                arcpy.SetParameterAsText(12, 'Success')
                return

        elif action.upper() == 'SIGNUP':
            send_email(signuptemplate, emailconfiginfo)
            #Set the output parameter
            arcpy.SetParameterAsText(12, 'Success')
            return
        else:
            arcpy.AddError('Invalid action parameters.')
            arcpy.SetParameterAsText(12, 'Failed')
            return
    except Exception as error:
        arcpy.AddError("Failed. " + str(error))
        arcpy.SetParameterAsText(9, ("Failed" + str(error)))

if __name__ == '__main__':
    main()
