from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib, sys

class EmailServer(object):
    def __init__(self, smtp_server, smtp_username=None, smtp_password=None, use_tls=False):
        self._server = smtplib.SMTP(smtp_server)
        if use_tls:
            self._server.starttls()
        self._server.ehlo()
        if smtp_username and smtp_password:
            self._server.esmtp_features['auth'] = 'LOGIN'
            self._server.login(smtp_username, smtp_password)

    def __enter__(self):
        return self

    def send(self, from_address="", reply_to="", to_addresses=[], cc_addresses=[], bcc_addresses=[], subject="", email_body=""):
        msg = MIMEMultipart()
        msg['from'] = from_address
        if reply_to != "":
            msg['reply-to'] = reply_to
        if len(to_addresses) > 0:
            msg['to'] = ", ".join(to_addresses)
        if len(cc_addresses) > 0:
            msg['cc'] = ", ".join(cc_addresses)
        msg['subject'] = subject
        msg.attach(MIMEText(email_body, 'html'))

        recipients = to_addresses + cc_addresses + bcc_addresses
        if ('') in recipients:
            recipients.remove('')
        if len(recipients) == 0:
            raise Exception("You must provide at least one e-mail recipient")

        self._server.sendmail(from_address, recipients, msg.as_string())

    def __exit__(self, exc_type, exc_value, traceback):
        self._server.quit()

def _add_warning(message):
    try:
        import arcpy
        arcpy.AddWarning(message)
    except ImportError:
        print(message)

def _set_result(index, value):
    try:
        import arcpy
        arcpy.SetParameter(index, value)
    except ImportError:
        pass

if __name__ == "__main__":
    smtp_server = sys.argv[1]
    smtp_username = sys.argv[2]
    smtp_password = sys.argv[3]
    use_tls = bool(sys.argv[4])
    from_address = sys.argv[5]
    reply_to = sys.argv[6]
    to_addresses = sys.argv[7].split(';')
    cc_addresses = sys.argv[8].split(';')
    bcc_addresses = sys.argv[9].split(';')
    subject = sys.argv[10]
    email_body = sys.argv[11]

    # Remove empty strings from addresses
    to_addresses[:] = (value for value in to_addresses if value != '' and value != '#')
    cc_addresses[:] = (value for value in cc_addresses if value != '' and value != '#')
    bcc_addresses[:] = (value for value in bcc_addresses if value != '' and value != '#')
    all_addresses = to_addresses + cc_addresses + bcc_addresses

    try:
        with EmailServer(smtp_server, smtp_username, smtp_password, use_tls) as smtp_server:
            smtp_server.send(from_address, reply_to, to_addresses, cc_addresses, bcc_addresses, subject, email_body)
        _set_result(11, True)
    except Exception as e:
        _add_warning("Failed to send e-mail. {0}".format(str(e)))
        _set_result(11, False)
