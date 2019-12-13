# ![Feature](https://raw.githubusercontent.com/ecirpnaes/DbSnapshotCreator/master/images/logo.png) Database Snapshot Creator

Provides a quick and easy way to create a snapshot of a database. The action can be executed directly against the server or scripted to a new SQL window so you can run it yourself.

## Installation

The current release is available to [download as a .vsix file](https://github.com/ecirpnaes/DbSnapshotCreator/releases/download/0.1.2/db-snapshot-creator-0.1.0.vsix) and can be installed by opening the File Menu and selecting `Install Extension from VSIX Package`

## Extension Settings

This extension contributes the following settings:

* `snapshotCreator.scriptOnly`: If this is checked, the snapshot extension will only create the SQL commands necessary to create or revert a snapshot. If you want the extension to actually execute the commands against the database, then leave this unchecked.

## How To Use

* Navigate to a database object in the Object Explorer Tree.
* Right click on a database node to bring up the context menu.
* If the database node is a database (and not a database snapshot), you have the option to create a snapshot.
* If the database node is a database snapshot, you will have the option to revert the source database from the snapshot.

![Feature](/images/createRevertExec.gif)

![Feature](/images/createRevertScript.gif)

## Known Issues

* This only works with the MSSQL provider, i.e. Microsoft SQL Server.
* Azure Data Studio lacks metadata information to indicate whether or not a database node is an actual database or a database snapshot. (This differs from SQL Management Studio where Database Snapshots are grouped under their own parent node.) As such, this extension assumes that all database nodes are actual databases unless the database name has `snapshot` in it. Hopefully the Azure Studio team will see fit to include this information in a future release.

## Unknown Issues

Can be raised here: <https://github.com/ecirpnaes/DbSnapshotCreator/issues>

## Release Notes

## 0.1.0

- Initial release.
