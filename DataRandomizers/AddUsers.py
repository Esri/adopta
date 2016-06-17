'''
 Run in py 2.7
'''
from __future__ import print_function
import arcpy
import random, string,datetime,time
#----------------------------------------------------------------------
def local_time_to_online(dt=None):
    """Converts datetime object to a UTC timestamp for AGOL.

    Args:
        dt (datetime): The :py:class:`datetime.datetime` object to convert. Defaults to ``None``, i.e., :py:func:`datetime.datetime.now`.

    Returns:
        float: A UTC timestamp as understood by AGOL (time in ms since Unix epoch * 1000)

    Examples:
        >>> arcresthelper.common.local_time_to_online() # PST
        1457167261000.0
        >>> dt = datetime.datetime(1993, 3, 5, 12, 35, 15) # PST
        >>> arcresthelper.common.local_time_to_online(dt)
        731392515000.0
    See Also:
       :py:func:`online_time_to_string` for converting a UTC timestamp

    """
    is_dst = None
    utc_offset = None
    try:
        if dt is None:
            dt = datetime.datetime.now()

        is_dst = time.daylight > 0 and time.localtime().tm_isdst > 0
        utc_offset =  (time.altzone if is_dst else time.timezone)

        return (time.mktime(dt.timetuple()) * 1000) + (utc_offset * 1000)
    except:
        line, filename, synerror = trace()
        raise ArcRestHelperError({
                    "function": "local_time_to_online",
                    "line": line,
                    "filename":  filename,
                    "synerror": synerror,
                                    }
                                    )
    finally:
        is_dst = None
        utc_offset = None

        del is_dst
        del utc_offset

#----------------------------------------------------------------------
def chunklist(l, n):
    """Yield successive n-sized chunks from l.

    Args:
        l (object): The object to chunk.
        n (int): The size of the chunks.
    Yields:
        The next chunk in the object.
    Raises:
        TypeError: if ``l`` has no :py:func:`len`.
    Examples:
        >>> for c in arcresthelper.common.chunklist(list(range(20)), 6):
        ...     print(c)
        [0, 1, 2, 3, 4, 5]
        [6, 7, 8, 9, 10, 11]
        [12, 13, 14, 15, 16, 17]
        [18, 19]
        >>> list(arcresthelper.common.chunklist(string.ascii_uppercase, 7))
        ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ']

    """
    n = max(1, n)
    for i in range(0, len(l), n):
        yield l[i:i+n]
#----------------------------------------------------------------------
def randomword(length):
    return ''.join(random.choice(string.lowercase) for i in range(length))
def main():
    asFields = "Assetstatus","RelateGUID","Adopteddate","Laststatusupdate","Lastcleaneddate","Nickname","Teamname"
    utFields = ['Email','Team','Firstname','Lastname']
    globalIDfield = ['GlobalID']
    userTable = r"C:\Projects\Github\AdoptA\DataRandomizers\RandomTest.gdb\User_table"
    assetTable = r"C:\Projects\Github\AdoptA\DataRandomizers\RandomTest.gdb\AssetLayer"
    numOfUsers = 2500
    teamBreak = 10
    assetPerUser = 2
    
    teamIdx = 10
    teamName = ''
    
    oidName='OBJECTID'
    arr = arcpy.da.FeatureClassToNumPyArray(assetTable, (oidName))
    
    
    newArr = chunklist(arr,assetPerUser)
    exprList = ["{0} >= {1} AND {0} <= {2}".format(oidName, nArr[0][0], nArr[len(nArr)-1][0])
                for nArr in newArr]    
    
    arcpy.DeleteRows_management(userTable)
    oids = []
    with arcpy.da.InsertCursor(userTable,utFields) as icursor:
        for i in range(0,numOfUsers):
            firstName = randomword(12)
            lastName = randomword(12)
            email= firstName[:1] + lastName + "@test.com"
            if teamIdx >= teamBreak:
                teamName  = randomword(9) + " " + randomword(4) + " " + randomword(20)
                teamIdx = 1
            oids.append(icursor.insertRow([email,teamName,firstName,lastName]))
            teamIdx = teamIdx + 1
               
            print ("{0} of {1} added".format(i,numOfUsers))
    del icursor
    
    for i in range(0,len(exprList)):
        expr = exprList[i]
        if i >= len(oids):
            break
        oid = oids[i]
        print (expr)
        with arcpy.da.SearchCursor(in_table=userTable,
                                   where_clause=str(oidName) + " = " + str(oid),
                                   field_names=globalIDfield) as scursor:

            for sRow in scursor:
                with arcpy.da.UpdateCursor(in_table=assetTable, 
                                           where_clause=expr,
                                           field_names=asFields) as ucursor:
                    for uRow in ucursor:
                        uRow[0] = "Adopted"
                        uRow[1] = sRow[0]
                        uRow[2] = datetime.datetime.now()
                        uRow[3] = datetime.datetime.now()
                        uRow[5] = randomword(22)
                        ucursor.updateRow (uRow)
                del ucursor
        del scursor

if __name__ == "__main__":
    main()    