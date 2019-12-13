'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { SnapshotHelper } from './SnapshotHelper';
import { BackgroundOperationArgs, SnapshotAction, SnapshotScriptingResults } from './common';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.snapshotDb', createSnapshot));
    context.subscriptions.push(vscode.commands.registerCommand('extension.revertSnapshot', revertSnapshot));
};

// Create Snapshot Command
async function createSnapshot(oeContext: azdata.ObjectExplorerContext) {
    if (!oeContext) {
        vscode.window.showErrorMessage("This extension cannot be run from the command menu.");
        return;
    }

    // run this as a background operation with status displaying in Tasks pane
    let backgroundOperationInfo: azdata.BackgroundOperationInfo = {
        connection: undefined,
        displayName: `Create snapshot of [${oeContext.connectionProfile.databaseName}] `,
        description: "A snapshot creation operation",
        isCancelable: true,
        operation: (operation: azdata.BackgroundOperation) => {
            return doSnapshotAction(operation, { context: oeContext, action: SnapshotAction.Create });
        }
    };
    azdata.tasks.startBackgroundOperation(backgroundOperationInfo);
};

// Revert Snapshot Command
async function revertSnapshot(oeContext: azdata.ObjectExplorerContext) {
    // console.log(oeContext);
    if (!oeContext) {
        vscode.window.showErrorMessage("This extension cannot be run from the command menu.");
        return;
    }
    let message: string = `Are you sure you wish to revert the database from the [${oeContext.connectionProfile.databaseName}] snapshot?`;
    let result: string | undefined = await vscode.window.showWarningMessage(message, { modal: true }, "Yes", "No");
    if (result && result === "Yes") {
        let backgroundOperationInfo: azdata.BackgroundOperationInfo = {
            connection: undefined,
            displayName: `Revert database from snapshot [${oeContext.connectionProfile.databaseName}] `,
            description: "A database restore operation",
            isCancelable: true,
            operation: (operation: azdata.BackgroundOperation) => {
                return doSnapshotAction(operation, { context: oeContext, action: SnapshotAction.Revert });
            }
        };
        azdata.tasks.startBackgroundOperation(backgroundOperationInfo);
    }
};

async function doSnapshotAction(backgroundOperation: azdata.BackgroundOperation, args: BackgroundOperationArgs) {
    backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, `${args.action} snapshot...`);
    let scriptOnly: boolean = vscode.workspace.getConfiguration("snapshotCreator").get("scriptOnly") === true;
    let snapshotHelper: SnapshotHelper = new SnapshotHelper(args.context, scriptOnly);
    let scriptingResult: SnapshotScriptingResults = (args.action == SnapshotAction.Create) ? await snapshotHelper.createSnapshot() : await snapshotHelper.revertSnapshot();

    if (scriptOnly && !scriptingResult.hasError) {
        let textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument({ language: 'sql' });
        let textEditor: vscode.TextEditor = await vscode.window.showTextDocument(textDocument, 1, false);
        textEditor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), scriptingResult.sqlStatements);            
        });
    }

    backgroundOperation.updateStatus(scriptingResult.hasError ? azdata.TaskStatus.Failed : azdata.TaskStatus.Succeeded, scriptingResult.resultsMessage);
    scriptingResult.hasError ? vscode.window.showWarningMessage(scriptingResult.resultsMessage) : vscode.window.showInformationMessage(scriptingResult.resultsMessage);
};

// this method is called when your extension is deactivated
export function deactivate() {
};