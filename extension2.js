const vscode = require("vscode")

/**
 * @param {vscode.ExtensionContext} context
 */

const axios = require("axios")


async function authenticate() {
    const options = [
        { label: 'Google', id: 'google'},
        { label: 'Micorosft', id: 'microsoft'},
        { label: 'GitHub', id: 'github'},
    ];

    const { id } = await vscode.window.showQuickPick(options, {
        placeHolder: 'Pick login method',
    });

    const authUri = `http://glichester.ddns.net:3000/auth/${id}`;
    const response = await vscode.env.openExternal(vscode.Uri.parse(authUri));

    if(response) {
        const userMail = await axios.default.get('http://glichester.ddns.net:3000/me');
        
        console.debug(userMail.data)
    }
}

function activate(context) {
    let disposable = vscode.commands.registerCommand('lhc.authenticate', authenticate);
    context.subscriptions.push(disposable);

    let disposable2 = vscode.languages.getLanguages().then(languages => {
        console.log("Lenguajes soportados por Visual Studio Code:");
        console.log(languages);
    });

    context.subscriptions.push(disposable2);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}