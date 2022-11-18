const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { Client, Events, Collection, GatewayIntentBits } = require('discord.js');
const { NaiUser, NaiHelper } = require('naihelper.js');
const { exit } = require('node:process');

async function main() {
	var clientId = process.env.CLIENTID;
	var discordToken = process.env.DISCORDTOKEN;
	var naiKey = process.env.NAIKEY;
	var pointLock = JSON.parse(process.env.POINTLOCK ?? 'false'.toLowerCase());

	if (clientId === undefined || discordToken === undefined || naiKey === undefined) {
		console.log('warning: clientId, token or neiKey not set');
		exit();
	}

	var naiUser = new NaiUser(naiKey);
	global.pointLock = pointLock;
	global.naiUser = naiUser;
	naiUser.token = await NaiHelper.login(naiUser.key);

	// discord client
	const client = new Client({ intents: [GatewayIntentBits.Guilds] });
	client.once(Events.ClientReady, c => {
		console.log(`Ready! Logged in as ${c.user.tag}`);
	});

	// load commands
	client.commands = new Collection();
	const commandsPath = path.join(__dirname, 'commands');
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}

	// register command

	const commands = [];

	for (const file of commandFiles) {
		const command = require(`./commands/${file}`);
		commands.push(command.data.toJSON());
	}

	const rest = new REST({ version: '10' }).setToken(discordToken);

	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);
			const data = await rest.put(
				Routes.applicationCommands(clientId),
				{ body: commands },
			);
			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			console.error(error);
		}
	})();

	// client handle
	client.on(Events.InteractionCreate, async interaction => {
		var logline = 'Server: ' + (interaction.member.guild.name ?? 'none') + ', User: ' + interaction.user.username + ', ';

		var logItem = [];
		for (const i of interaction.options.data) {
			logItem.push(i.name + ': ' + i.value);
		}
		console.log(logline+logItem.join(', '));

		if (interaction.member === null) {
			console.log('PM reject up command');
			await interaction.reply({ content: 'You cannot use this from private message' });
			return;
		}

		if (!interaction.isChatInputCommand()) return;
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}
		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	});

	// login
	client.login(discordToken);
}

main()