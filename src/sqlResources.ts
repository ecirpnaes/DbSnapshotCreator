export const getCreateSnapshotSql = (sourceDb: string, scriptOnly: number) => `
 use master;
 set nocount on;
 BEGIN TRY
 
 declare @scriptOnly bit = ${scriptOnly};
 declare @fileSql	varchar(3000)	= '' ;
 declare @sourceDb	varchar(100) = '${sourceDb}';
 declare @filePath	varchar(200) = null;
 declare @tempAppendSql	varchar(200) = '_Snapshot_' + replace(convert(varchar(20), GETUTCDATE(),110),'-','_'); 
 declare @execSql	nvarchar(4000) = '';
 declare @snapDbName varchar(200);
 declare @appendSql varchar(200); 

 -- create a unique name for the snapshot
 declare @counter int = 1;
 select @appendSql = @tempAppendSql + '_0' + convert(varchar, @counter);
 select @snapDbName = @sourceDb + @appendSql;
 while exists (select * from sys.databases dbs where dbs.[name] = @snapDbName )
     begin    
         select @counter = @counter + 1;
         declare @snapCounter varchar(5) = convert(varchar(5), @counter);        
         if (len(@snapCounter) < 2) select @snapCounter = '0' + @snapCounter;
         select @appendSql = @tempAppendSql + '_' + @snapCounter;
         select @snapDbName = @sourceDb + @appendSql;        
     end;

 -- Script to get filename(s) based on
 -- https://www.sqlservercentral.com/scripts/create-database-snapshot-dynamically
 select @fileSql = @fileSql +
     case when @fileSql <> '' then + ',' else '' end 
     + '(NAME = [' + smf.[name] + '],' + char(10) +  'FILENAME = ''' + isnull(@filePath, left(smf.[physical_name], len(smf.[physical_name])- 4 )) + @appendSql + '.ss'')'		
 from sys.master_files as smf
 join sys.databases as sdb on sdb.[database_id] = smf.[database_id]
     where sdb.[state] = 0 -- online databases.
     and smf.[type] = 0 -- data files.
     and sdb.[name] = @sourceDb;
 
 select @execSql = 'CREATE DATABASE [' + @snapDbName + '] ON ' + char(10) + @fileSql + char(10) + ' AS SNAPSHOT OF [' + @sourceDb + '];'
 --print @execSql;
 if (@scriptOnly = 1) -- just return the sql
     begin	
         select 'success',  @execSql;
     end
 else 
     begin		
         exec sp_executesql @execSql;
         select 'success',  @snapDbName;
     end

END TRY
  BEGIN CATCH
      select 'error', ERROR_MESSAGE();
  END CATCH
`;

export const getRevertSnapshotSql = (snapshotName: string, scriptOnly: number) => `
use master;
set nocount on;
BEGIN TRY

declare @scriptOnly bit = ${scriptOnly};
declare @sourceDb varchar(400);
declare @sourceDbId int;
declare @snapshotName varchar(400) = '${snapshotName}';

-- Ensure that this DB is a snapshot and can actually be reverted
 if not exists (select * from sys.databases db where db.[name] = @snapshotName and db.source_database_id is not null)
    begin
        select 'error', 'Cannot revert [' + @snapShotName + ']. It is not a snapshot!';
        return;
    end; 

select @sourceDb = db.[name], @sourceDbId = db.database_id
    from sys.databases db
    join sys.databases snaps on db.database_id = snaps.source_database_id
    where snaps.[database_id] is not NULL
    and snaps.[name] = @snapshotName;

-- create a table to hold the statements we need to execute
declare @tblSql table (rowId int, sqlString varchar(2000));

-- create any 'drop database' statements needed
insert @tblSql
	select ROW_NUMBER() over(order by snaps.[name]), 'use master; drop database [' + snaps.[name] + '];'
        from sys.databases snaps
        where snaps.[source_database_id] = @sourceDbId
        and snaps.[name] <> @snapshotName;

-- insert alter database and restore statements
declare @rowCount int = (select count(*) from @tblSql);
insert @tblSql
    select  @rowCount + 1, 'use master; alter database [' + @sourceDb + '] set single_user with rollback immediate;' union
    select  @rowCount + 2, 'use master; alter database [' + @sourceDb + '] set multi_user;' union
    select  @rowCount + 3, 'use master; restore database [' + @sourceDb + '] from database_snapshot = ''' + @snapshotName + ''';'

if (@scriptOnly = 1) -- return the scripts
    select 'success', t.[sqlString] from @tblSql t
else
    begin
        select @rowCount = count(*) from @tblSql;
        declare @rowCounter int = 1;
        declare @sql nvarchar(4000) = '';
        while (@rowCounter <= @rowCount)
            begin
                select @sql = t.sqlString 
                    from @tblSql t 
                    where t.rowId = @rowCounter;
                exec sp_executesql @sql;
                select @rowCounter = @rowCounter + 1;
            end
        select 'success',  @snapshotName;
    end;

END TRY
     BEGIN CATCH
         select 'error',  ERROR_MESSAGE();
     END CATCH
`;

export const getSourceDbName = (snapshotName: string) => `
use master; select db.[name]
from sys.databases db
join sys.databases snaps
on db.database_id = snaps.source_database_id
where snaps.[database_id] is not NULL
and snaps.[name] = '${snapshotName}';`

