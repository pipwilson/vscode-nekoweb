import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const NEKOWEB_API = 'https://nekoweb.org/api';
const NEKOWEB_SITE_INFO = '/site/info';
const NEKOWEB_READ_FOLDER = '/files/readfolder';
const NEKOWEB_UPLOAD_FILE = '/files/upload';

export function activate(context: vscode.ExtensionContext) {

	const setAuthTokenCommand = vscode.commands.registerCommand('nekoweb.setAuthorizationToken', async () => {
		const authToken = await vscode.window.showInputBox({
			prompt: 'Enter your authorization token',
			ignoreFocusOut: true
		});

		if (authToken !== undefined) {
			const config = vscode.workspace.getConfiguration('nekoweb');
			await config.update('authorizationToken', authToken, vscode.ConfigurationTarget.Global);
			await config.update('username', await getUsername(), vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage('Authorization token has been updated.');
		}
	});

	const helloWorldCommand = vscode.commands.registerCommand('nekoweb.helloWorld', async () => {
		const response = await getApiResponse(NEKOWEB_SITE_INFO);
		if (typeof response === 'string') {
			vscode.window.showErrorMessage(response);
			return;
		}
		const message = response.data.title;
		vscode.window.showInformationMessage(message);
	});

	const readFolderCommand = vscode.commands.registerCommand('nekoweb.readFolder', async () => {
		const response = await getApiResponse(NEKOWEB_READ_FOLDER, { pathname: '/' });

		if (typeof response === 'string') {
			vscode.window.showErrorMessage(response);
			return;
		}

		const htmlFiles = response.data.filter((file: { name: string; }) => file.name.endsWith('.html')).map((file: { name: string; }) => file.name);
		const selectedOption = await vscode.window.showQuickPick(htmlFiles, { placeHolder: 'Select an HTML file' });

		if (selectedOption) {
			const config = vscode.workspace.getConfiguration('nekoweb');
			const username = config.get<string>('username', '');
			downloadFile(`https://${username}.nekoweb.org/${selectedOption}`, path.join(__dirname, selectedOption));
		}
	});

	const uploadFileCommand = vscode.commands.registerCommand('nekoweb.uploadFile', async () => {
		const fileUri = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Select file to upload',
			filters: {
				'All files': ['html']
			}
		});

		if (fileUri && fileUri[0]) {
			const filePath = fileUri[0].fsPath;
			const config = vscode.workspace.getConfiguration('nekoweb');
			const authToken = config.get<string>('authorizationToken', '');

			if (!authToken) {
				return 'Error: Authorization token is not set. Please configure it in the settings.';
			}
			const FormData = require('form-data');
			const form = new FormData();
			form.append('pathname', '/');
			form.append('files', fs.createReadStream(filePath));

			const options = {
				method: 'POST',
				url: `${NEKOWEB_API}${NEKOWEB_UPLOAD_FILE}`,
				headers: {
					Authorization: authToken,
					...form.getHeaders()
				},
				data: form
			};
			try {
				const { data } = await axios.request(options);
				console.log(data);
				vscode.window.showInformationMessage('File uploaded successfully');
			} catch (error: any) {
				console.error(error);
				vscode.window.showErrorMessage(`Error uploading file: ${error.message}`);
			}

		} else {
			vscode.window.showWarningMessage('No file selected');
		}
	});


	context.subscriptions.push(setAuthTokenCommand);
	context.subscriptions.push(helloWorldCommand);
	context.subscriptions.push(readFolderCommand);
	context.subscriptions.push(uploadFileCommand);
}

async function getApiResponse(apiMethod: string, options: { [key: string]: any } = {}): Promise<string | AxiosResponse<any, any>> {
	try {
		const apiEndpoint = NEKOWEB_API;
		const config = vscode.workspace.getConfiguration('nekoweb');
		const authToken = config.get<string>('authorizationToken', '');

		console.log(`making API call to ${apiMethod} with params ${JSON.stringify(options)}`);

		if (!authToken) {
			return 'Error: Authorization token is not set. Please configure it in the settings.';
		}

		const response = await axios.get(apiEndpoint + apiMethod, {
			headers: {
				'Authorization': authToken
			},
			params: options
		});

		console.log(`API response: ${JSON.stringify(response.data)}`);
		return response;
	} catch (error: any) {
		return `Error: ${error.message}`;
	}
}

async function getUsername(): Promise<string | undefined> {
	const response = await getApiResponse(NEKOWEB_SITE_INFO);
	if (typeof response === 'string') {
		vscode.window.showErrorMessage(response);
		return;
	}
	const username = response.data.username;
	return username;
}

async function downloadFile(url: string, outputLocationPath: string) {
	const writer = fs.createWriteStream(outputLocationPath);

	const response = await axios({
		url,
		method: 'GET',
		responseType: 'stream'
	});

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on('finish', () => {
			vscode.window.showInformationMessage(`Downloaded to ${outputLocationPath}`);
			resolve;
		});
		writer.on('error', (err) => {
			vscode.window.showErrorMessage(`Error downloading file: ${err.message}`);
			reject(err);
		});
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }
