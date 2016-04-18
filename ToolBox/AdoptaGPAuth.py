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
#                       2. appURL: contains the url of the application along
#                                  with the userid and assetid
#               -----constants:
#                       1.fromemail: The email from which the email which be
#                                    sent.
#                       2.emailtemplate: The html template containing the email
#                                       body
#                       3.smtppassword: SMTP user password
#                       4.smtpusername: SMTP user name
#                       5.subjectline: Contains the subject line of the email
#                       6.smtpserver:  Contains the configured SMTP server
#                                      information
#                       7.usetls:      Boolean parameter which checks if to use
#                                      TLS.
#             The constants are preconfigured and set as constant value while
#             deploying the code for the first time.
#             The script takes the input, incorporates the HTML template in the
#             email, appends the appURL provided by user amd sends the email to
#             the provided email id.
#-------------------------------------------------------------------------------

#---------------------- Necessary Modules--------------------------------------#
import arcpy
from email.MIMEMultipart import MIMEMultipart
from email.MIMEText import MIMEText
import smtplib
#------------------------------------------------------------------------------#

def send_email(emailtemplate, url, fromemail, toemail, subjectline, smtpserver,
               smtppassword, smtpusername, usetls):
    """ This method takes file template for email body and url as input, formats
        the text and sends the email.  """
    error = ''
    fromaddr = fromemail
    toaddr = toemail
    msg = MIMEMultipart()
    msg['From'] = fromaddr
    msg['To'] = toaddr
    msg['Subject'] = subjectline
    # Open the input html file and read the html content.
    files = open(emailtemplate, "r")
    body = files.read()

    # Append the user provided app url to the email body
    msg.attach(MIMEText(body + '\n' + url, 'html'))
    #TODO: Format the font of URL.
    server = smtplib.SMTP(smtpserver)

    if usetls:
        try:
            server.starttls()
            server.ehlo()
            if smtppassword != None and smtpusername != None:
                server.esmtp_features['auth'] = 'LOGIN'
                server.login(smtpusername, smtppassword)
        except Exception as error:
            arcpy.AddError(error)
    else:
        server.ehlo()
    text = msg.as_string()
    server.sendmail(fromaddr, toaddr, text)
    server.quit()


def main():
    error = ''
    #input parameters
    toemail = arcpy.GetParameterAsText(1)
    appURL = arcpy.GetParameterAsText(4)

    #constants
    fromemail = arcpy.GetParameterAsText(0)
    subjectline = arcpy.GetParameterAsText(2)
    emailtemplate = arcpy.GetParameterAsText(3)
    smtpserver = arcpy.GetParameterAsText(5)
    smtpusername = arcpy.GetParameterAsText(6)
    smtppassword = arcpy.GetParameterAsText(7)
    usetls = arcpy.GetParameterAsText(8)

    try:
        #Send email
        send_email(emailtemplate, appURL, fromemail, toemail, subjectline,
                   smtpserver, smtppassword, smtpusername, usetls)
        #Set the output parameter
        arcpy.SetParameterAsText(9, 'Success')
    except Exception as error:
        arcpy.AddError(error)
        arcpy.SetParameterAsText(9, 'Failed')
#TODO:add error codes , for example, catch TLS and other errors specifically
#     and return them. This would help us understand wherein the service failed.
if __name__ == '__main__':
    main()
