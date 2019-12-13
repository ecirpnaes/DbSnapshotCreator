
import { ObjectExplorerContext } from 'azdata';

export interface BackgroundOperationArgs {
    context: ObjectExplorerContext;
    action: SnapshotAction;
};

export interface SnapshotScriptingResults {
    hasError: boolean;    
    resultsMessage: string;    
    sqlStatements: string
};

export enum SnapshotAction {
    Create = 0,
    Revert = 1
};