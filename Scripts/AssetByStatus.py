from __future__ import print_function
import arcrest
from arcrest.security import AGOLTokenSecurityHandler
from arcrest.agol import FeatureLayer
import csv
import datetime
import os
import arcresthelper
from arcresthelper import common

def validate(date_text,dateTimeFormat):
    try:
        datetime.datetime.strptime(date_text, dateTimeFormat)
        return True
    except ValueError:
       return False
def trace():
    """
        trace finds the line, the filename
        and error message and returns it
        to the user
    """
    import traceback, inspect
    tb = sys.exc_info()[2]
    tbinfo = traceback.format_tb(tb)[0]
    filename = inspect.getfile(inspect.currentframe())
    # script name + line number
    line = tbinfo.split(", ")[1]
    # Get Python syntax error
    #
    synerror = traceback.format_exc().splitlines()[-1]
    return line, filename, synerror

def main():
    try:
        dateTimeFormat = "%Y/%m/%d %H:%M:%S"#Date time format of the service, example'2016-04-26 04:00:00'
        #log file to store details
        logFile = r"c:\temp\adoptedAssets.log"
        common.init_log(logFile)
        print ("###### Date Extraction Process Started ######")
        username = ""
        password = ""
        proxy_port = None
        proxy_url = None
        agolSH = None
        print ("\tStarted at {0}".format(datetime.datetime.now().strftime(dateTimeFormat)))
        #Create a authenicated connection to portal
        if username != "":
            agolSH = AGOLTokenSecurityHandler(username=username,
                                          password=password)
            print ("\tLogged into the portal")
    
        #Settings
        url = 'http://services1.arcgis.com/DlnuvLGpDczjeSgG/arcgis/rest/services/CatchBasin/FeatureServer/0/' #URL to adoption service
        statusField = 'Assetstatus' #Field with status, used to build SQL
        statusValue = 'Adopted' #Value to search for in the StatusField
        statusUpdateField = 'Laststatusupdate' #Field used to restrict query to only records since last query
        out_fields ='OBJECTID,GIS_ID,Nickname' #Fields to save to the output CSV
    
        #The location and file name to save the results to
        saveLocation = r"c:\temp\adoptedAssets.csv"
        #File with the date of the last run, if it does not exist, all features are returned and file is created for next run
        lastRunDetails = r"c:\temp\lastrundate.txt"
        
        lastQueryDate = None
        #Start building the SQL Query
        sql = statusField + " = '" + statusValue + "'"
        #Open the file with the last run date
        if os.path.isfile(lastRunDetails):
            print("\tLast run file exist")
            with open(lastRunDetails, 'r') as configFile:
                lastQueryDate = configFile.read()
                configFile.close()
            print("\t\tLast query date: {0}".format(lastQueryDate))
        #If the last query date file was found and value is a date
        if lastQueryDate is not None and validate(date_text=lastQueryDate, dateTimeFormat=dateTimeFormat):
            sql = sql + " AND " + statusUpdateField + " >= " + "'" + lastQueryDate + "'"
        #Add current time to query
        queryDate = datetime.datetime.now().strftime(dateTimeFormat)
        sql = sql + " AND " + statusUpdateField + " <= " + "'" + queryDate + "'"
        print("\tSQL: {0}".format(sql))
        #Create a connection to the layer
        fl = FeatureLayer(
            url=url,
            securityHandler=agolSH,
            proxy_port=proxy_port,
            proxy_url=proxy_url,
            initialize=True)
        
        #query the layer
        featureSet  = fl.query(where=sql,
                               out_fields=out_fields,
                               returnGeometry=False) 
        print("\t{0} feature returned".format(len(featureSet.features)))
        #Create a new output writer
        if (len(featureSet.features) == 0):
            if os.path.isfile(saveLocation):
                os.remove(saveLocation)
        else:
            with open(saveLocation, "wb+") as csvFile:
                f = csv.writer(csvFile)
                fields = []
                #write the headers to the csv
                for field in featureSet.fields:
                    fields.append(field['name'])
                f.writerow(fields)
                
                newRow = []
                #Loop through the results and save each to a row
                for feature in featureSet:
                    newRow = []
                    for field in featureSet.fields:
                        newRow.append(feature.get_value(field['name']))
                    f.writerow(newRow)
                csvFile.close()
                print("\tCSV updated")
        #Update the last run file
        with open(lastRunDetails, 'w') as configFile:
            configFile.write(queryDate)
            configFile.close()
            print("\t{0} saved to file".format(queryDate))
        print ("\tCompleted at {0}".format(datetime.datetime.now().strftime(dateTimeFormat)))
        print ("###### Completed ######")
    
    except:
        line, filename, synerror = trace()
        print ("error on line: %s" % line)
        print ("error in file name: %s" % filename)
        print ("with error message: %s" % synerror)
        
if __name__ == "__main__":
    main()