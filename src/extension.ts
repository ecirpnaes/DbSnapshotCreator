'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { SnapshotHelper } from './SnapshotHelper';

export function activate(context: vscode.ExtensionContext) {

    // create snapshot command
    context.subscriptions.push(vscode.commands.registerCommand('extension.snapshotDb', async (oeContext: azdata.ObjectExplorerContext) => {

        if (!oeContext) {
            vscode.window.showErrorMessage("This extension cannot be run from the command menu.");
            return;
        }

        // run this as a background operation with status displaying in Tasks pane
        let backgroundOperationInfo: azdata.BackgroundOperationInfo = {
            connection: undefined,
            displayName: `Creating snapshot of : ${oeContext.connectionProfile.databaseName} `,
            description: "A snapshot creation operation",
            isCancelable: true,
            operation: (operation: azdata.BackgroundOperation) => {
                return createSnapshot(operation, { context: oeContext, action: "Creating" });
            }
        };
        azdata.tasks.startBackgroundOperation(backgroundOperationInfo);
    }));

    // Revert database from snapshot command
    context.subscriptions.push(vscode.commands.registerCommand('extension.revertSnapshot', async (oeContext: azdata.ObjectExplorerContext) => {
console.log(oeContext);
        if (!oeContext) {
            vscode.window.showErrorMessage("This extension cannot be run from the command menu.");
            return;
        }

        // run this as a background operation with status displaying in Tasks pane
        let backgroundOperationInfo: azdata.BackgroundOperationInfo = {
            connection: undefined,
            displayName: `Reverting database from snapshot : ${oeContext.connectionProfile.databaseName} `,
            description: "A database restore operation",
            isCancelable: true,
            operation: (operation: azdata.BackgroundOperation) => {
                return createSnapshot(operation, { context: oeContext, action: "Reverting" });
            }
        };
        azdata.tasks.startBackgroundOperation(backgroundOperationInfo);
    }));
}

async function createSnapshot(backgroundOperation: azdata.BackgroundOperation, args: BackgroundOperationArgs) {
    backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, `${args.action} snapshot...`);
    let snapshotHelper: SnapshotHelper = new SnapshotHelper(args.context);
    let result: string;
    if (args.action == "Creating") {
        result = await snapshotHelper.createSnapshot();
    } else {
        result = await snapshotHelper.revertSnapshot();
    }
    backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, result);
    vscode.window.showInformationMessage(result);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

interface BackgroundOperationArgs {
    context: azdata.ObjectExplorerContext;
    action: string;
}

