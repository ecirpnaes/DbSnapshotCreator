import * as sqlResources from './sqlResources';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

export class SnapshotHelper {

    private _oeContext: azdata.ObjectExplorerContext;

    constructor(oeContext: azdata.ObjectExplorerContext) {
        this._oeContext = oeContext;
    }

    public async createSnapshot(): Promise<string> {
        return this.executeSql(sqlResources.getCreateSnapshotSql(this._oeContext.connectionProfile.databaseName), "create");
    }

    public async revertSnapshot(): Promise<string> {
        return this.executeSql(sqlResources.getRevertSnapshotSql(this._oeContext.connectionProfile.databaseName), "revert");
    }

    private async executeSql(sql: string, action: string): Promise<string> {
        let connectionResult: azdata.ConnectionResult = await azdata.connection.connect(this._oeContext.connectionProfile, false, false);
        if (!connectionResult.connected) {
            vscode.window.showErrorMessage(connectionResult.errorMessage);
            return "Could not connect to database!";
        }

        let returnMessage: string = action == "create" ? "There was an error creating the snapshot" : "There was an error reverting the database";
        let successMessage: string = action == "create" ? "created database snapshot" : "reverted database from";
        try {
            let connectionUri: string = await azdata.connection.getUriForConnection(connectionResult.connectionId);
            let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
            let executionResult: azdata.SimpleExecuteResult = await queryProvider.runQueryAndReturn(connectionUri, sql);
            if (executionResult) {
                let statusMsg: string = executionResult.rows[0][0].displayValue;
                if (statusMsg == "success") {
                    returnMessage = `Successfully ${successMessage} [${executionResult.rows[0][1].displayValue}]`;
                    this.refreshDatabaseNode();
                }
            }
        } catch (e) {
            if (e instanceof Error)
                return e.message;
            else
                throw e;
        }
        return returnMessage;
    }

    private async refreshDatabaseNode() {
        let objectExplorerNode: azdata.objectexplorer.ObjectExplorerNode = await azdata.objectexplorer.getNode(this._oeContext.connectionProfile.id, this._oeContext.nodeInfo.nodePath);
        if (objectExplorerNode) {
            let rootNode: azdata.objectexplorer.ObjectExplorerNode = await objectExplorerNode.getParent();
            if (rootNode) {
                rootNode.refresh();
            }
        }
    }
}