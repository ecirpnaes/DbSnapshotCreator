export const getCreateSnapshotSql = (sourceDb: string) => `
/********************************************************************************
 -- Script based on article at
 -- https://www.sqlservercentral.com/scripts/create-database-snapshot-dynamically
 *********************************************************************************/
 
 use master;
 set nocount on;
 BEGIN TRY
 
 declare @fileSql	varchar(3000)	= '' ;
 declare @sourceDb	varchar(100) = '${sourceDb}';
 declare @filePath	varchar(200) = null;
 declare @appendSql	varchar(200) = '_Snapshot_' + replace(convert(varchar(20), GETUTCDATE(),110),'-','_');
 declare @snapCount  varchar(5);
 declare @execSql	nvarchar(4000) = '';
 
 -- get the number of existing snapshots for this db
 select @snapCount = count(*) + 1
 from sys.databases snaps
 join sys.databases db
 on db.database_id = snaps.source_database_id
 where snaps.[database_id] is not NULL
 and db.[name] = @sourceDb;
 
 if (len(@snapCount) < 2) 
     select @snapCount = '0' + @snapCount;
 
 -- append the number onto the name
 select @appendSql = @appendSql + '_' + @snapCount;
 
 select @fileSql = @fileSql +
     case when @fileSql <> '' then + ',' else '' end 
     -- Remove file extension .mdf, .ndf
     +  	'( NAME = ' + smf.[name] + ', FILENAME = ''' + isnull(@filePath, left(smf.physical_name, len(smf.physical_name)- 4 )) + @appendSql + '.ss'')'		
 from sys.master_files as smf
 join sys.databases as sdb on sdb.database_id = smf.database_id
 where sdb.[state] = 0 -- online databases.
 and smf.[type] = 0 -- data files.
 and sdb.[name] = @sourceDb;
 
 select @execSql = 'CREATE DATABASE [' + @sourceDb + @appendSql + '] ON ' + @fileSql + ' AS SNAPSHOT OF [' + @sourceDb + '];'
 
 exec sp_executesql @execSql;
 select 'success',  @sourceDb + @appendSql;
 
 END TRY
     BEGIN CATCH
         select 'error', ERROR_MESSAGE();
     END CATCH
`;

export const getRevertSnapshotSql = (snapshotName: string) => `
use master;
set nocount on;
BEGIN TRY

declare @sourceDb varchar(400);
declare @sourceDbId int;
declare @snapshotName varchar(400) = '${snapshotName}';

select @sourceDb = db.[name], @sourceDbId = db.database_id
from sys.databases db
join sys.databases snaps
on db.database_id = snaps.source_database_id
where snaps.[database_id] is not NULL
and snaps.[name] = @snapshotName;

declare @tbl table (rowId int, dropSql varchar(2000));
insert @tbl
	select ROW_NUMBER() over(order by snaps.[name]), 'use master; drop database [' + snaps.[name] + '];'
	from sys.databases snaps
	where snaps.[source_database_id] = @sourceDbId
	and snaps.[name] <> @snapshotName;

declare @rowCount int = (select count(*) from @tbl);
declare @rowCounter int = 1;
declare @dropSql nvarchar(4000) = '';

while (@rowCounter <= @rowCount)
	begin
		select @dropSql =  t.dropSql 
			from @tbl t 
			where t.rowId = @rowCounter;
		exec sp_executesql @dropSql;
		select @rowCounter = @rowCounter + 1;
	end

declare @setSingleSql nvarchar(2000) = 'use master; alter database [' + @sourceDb + '] set single_user with rollback immediate;';
declare @setMultiSql nvarchar(2000) = 'use master; alter database [' + @sourceDb + '] set multi_user;';
declare @restoreDbSql nvarchar(2000) ='use master; restore database [' + @sourceDb + '] from database_snapshot = ''' + @snapshotName + ''';';

exec sp_executesql @setSingleSql;
exec sp_executesql @setMultiSql;
exec sp_executesql @restoreDbSql;
select 'success',  @sourceDb;
END TRY
     BEGIN CATCH
         select 'error',  ERROR_MESSAGE();
     END CATCH
`

