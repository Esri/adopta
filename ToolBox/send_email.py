from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import arcpy

def send(subject, email_body, from_address, smtp_server, smtp_username=None, smtp_password=None, use_tls=False, to_addresses=[], cc_addresses=[], bcc_addresses=[]):
    """ send email"""
    msg = MIMEMultipart()
    msg['from'] = from_address
    msg['to'] = ", ".join(to_addresses)
    msg['cc'] = ", ".join(cc_addresses)
    msg['subject'] = subject
    msg.attach(MIMEText(email_body, 'html'))
    server = smtplib.SMTP(smtp_server)

    if use_tls:
        server.starttls()
    server.ehlo()
    if smtp_username and smtp_password:
        server.esmtp_features['auth'] = 'LOGIN'
        server.login(smtp_username, smtp_password)

    recipients = list(set(to_addresses + cc_addresses + bcc_addresses))
    if ('') in recipients:
        recipients.remove('')
    if len(recipients) == 0:
        raise Exception("You must provide at least one e-mail recipient")
    messagebody = msg.as_string()
    server.sendmail(from_address, recipients, messagebody)
    server.quit()

if __name__ == "__main__":
    smtp_server = arcpy.GetParameterAsText(0)
    smtp_username = arcpy.GetParameterAsText(1)
    smtp_password = arcpy.GetParameterAsText(2)
    use_tls = arcpy.GetParameter(3)
    from_address = arcpy.GetParameterAsText(4)
    to_addresses = arcpy.GetParameterAsText(5).split(';')
    cc_addresses = arcpy.GetParameterAsText(6).split(';')
    bcc_addresses = arcpy.GetParameterAsText(7).split(';')
    subject = arcpy.GetParameterAsText(8)
    email_body = arcpy.GetParameterAsText(9)

    try:
        send(subject, email_body, from_address, smtp_server, smtp_username, smtp_password, use_tls, to_addresses, cc_addresses, bcc_addresses)
    except Exception as e:
        arcpy.AddError("Failure in sending email. {0}".format(str(e)))