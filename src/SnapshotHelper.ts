import * as sqlResources from './sqlResources';
import { SnapshotScriptingResults, SnapshotAction } from './common';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

export class SnapshotHelper {

    private _oeContext: azdata.ObjectExplorerContext;
    private _scriptOnly: boolean;
    private _scripting: number;

    constructor(oeContext: azdata.ObjectExplorerContext, scriptOnly: boolean) {
        this._oeContext = oeContext;
        this._scriptOnly = scriptOnly;
        this._scripting = scriptOnly ? 1 : 0;
    }

    public async createSnapshot(): Promise<SnapshotScriptingResults> {
        let sql: string = sqlResources.getCreateSnapshotSql(this._oeContext.connectionProfile.databaseName, this._scripting);
        let executionResult: azdata.SimpleExecuteResult | undefined = await this.executeSql(sql);
        this.refreshDatabaseNode();
        return this.getScriptingResults(executionResult, SnapshotAction.Create);
    }

    public async revertSnapshot(): Promise<SnapshotScriptingResults> {
        let sql: string = sqlResources.getRevertSnapshotSql(this._oeContext.connectionProfile.databaseName, this._scripting);
        let executionResult: azdata.SimpleExecuteResult | undefined = await this.executeSql(sql);
        this.refreshDatabaseNode();
        return this.getScriptingResults(executionResult, SnapshotAction.Revert);
    }

    private getScriptingResults(executionResult: azdata.SimpleExecuteResult | undefined, snapshotAction: SnapshotAction): SnapshotScriptingResults {
        if (!executionResult)
            return { hasError: true, resultsMessage: "Unspecified Error", sqlStatements: "" };

        return {
            hasError: (executionResult.rows[0][0].displayValue != "success"),
            sqlStatements: this.getSqlStatements(executionResult),
            resultsMessage: this.getResultsMessage(executionResult, snapshotAction)
        };
    }

    private getResultsMessage(executionResult: azdata.SimpleExecuteResult, snapshotAction: SnapshotAction): string {
        if (executionResult.rows[0][0].displayValue != "success")
            return executionResult.rows[0][1].displayValue;

        if (this._scriptOnly)
            return "Successfully scripted sql statements.";

        if (snapshotAction == SnapshotAction.Create) {
            return `Successfully created snapshot of database [${this._oeContext.connectionProfile.databaseName}]. \n Snapshot name is [${executionResult.rows[0][1].displayValue}] and is displayed under the datatbase node.`;
        }
        return `Successfully reverted database [${executionResult.rows[0][1].displayValue}] from snapshot [${this._oeContext.connectionProfile.databaseName}]`;
    }

    private getSqlStatements(resultSet: azdata.SimpleExecuteResult): string {
        if (!this._scriptOnly) return "";
        let sqlStatements: string[] = [];
        const colNum: number = 1;
        for (let i: number = 0; i !== resultSet.rowCount; i++) {
            sqlStatements.push(resultSet.rows[i][colNum].displayValue);
        }
        return sqlStatements.join('\n');
    }

    // public async getSourceDbName(): Promise<string> {
    //     let sql: string = sqlResources.getSourceDbName(this._oeContext.connectionProfile.databaseName);
    //     let executionResult: azdata.SimpleExecuteResult | undefined = await this.executeSql(sql);
    //     if (executionResult) {
    //         return executionResult.rows[0][0].displayValue;
    //     }
    //     return "";
    // }

    private async executeSql(sql: string): Promise<azdata.SimpleExecuteResult | undefined> {
        let connectionResult: azdata.ConnectionResult = await azdata.connection.connect(this._oeContext.connectionProfile, false, false);
        if (!connectionResult.connected) {
            vscode.window.showErrorMessage(connectionResult.errorMessage);
            return undefined;
        }
        try {
            let connectionUri: string = await azdata.connection.getUriForConnection(connectionResult.connectionId);
            let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
            return await queryProvider.runQueryAndReturn(connectionUri, sql);
        } catch (e) {
            if (e instanceof Error)
                console.log(sql);
            else
                throw e;
        }
    }

    private async refreshDatabaseNode() {
        // if we're only scipting, no need to refresh the tree
        if (this._scriptOnly) return;

        // get the actual node that was clicked on
        let objectExplorerNode: azdata.objectexplorer.ObjectExplorerNode = await azdata.objectexplorer.getNode(this._oeContext.connectionProfile.id, this._oeContext.nodeInfo.nodePath);
        if (objectExplorerNode) {
            // get the parent and refresh it. (should be the [Databases] node)
            let rootNode: azdata.objectexplorer.ObjectExplorerNode = await objectExplorerNode.getParent();
            if (rootNode) {
                rootNode.refresh();
            }
        }
    }
}