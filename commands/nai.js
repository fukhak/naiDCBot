const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { NaiHelper } = require('naihelper.js');

if (global.naiUser === undefined) throw Error('No defined naiUser on global');
var naiUser = global.naiUser;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nai')
		.setDescription('NovelAi private function')
		.addSubcommand(subcommand =>
			subcommand.setName('anlas')
				.setDescription('check anlas')
				.addBooleanOption(option =>
					option.setName('public')
						.setDescription('Show return information for anyone')
				)
		)
		.addSubcommand(subcommand =>
			subcommand.setName('image')
				.setDescription('generate image')
				.addStringOption((option) =>
					option.setName('prompt')
						.setDescription('prompt')
						.setRequired(true))
				.addBooleanOption(option =>
					option.setName('quality_toggle')
						.setDescription('Add some default word for prompt, default True'))
				.addStringOption(option =>
					option.setName('neg_prompt')
						.setDescription('Negative prompt, empty will add perset keywords'))
				.addIntegerOption(option =>
					option.setName('width')
						.setDescription('Image width pixel, 64-640(1024), must use height, override by layout')
						.setMinValue(64)
						.setMaxValue(1024))
				.addIntegerOption(option =>
					option.setName('height')
						.setDescription('Image height pixel, 64-640(1024) must use width, override by layout')
						.setMinValue(64)
						.setMaxValue(1024))
				.addStringOption(option => {
					NaiHelper.persetLayout().forEach((layout, key) => option.addChoices({
						name: layout[2] + ' (' + layout[0] + 'x' + layout[1] + ')',
						value: key
					}))
					return option.setName('layout')
						.setDescription('Perset Layout, override width and height')
				})
				.addIntegerOption(option =>
					option.setName('seed')
						.setDescription('Seed, 0-2^32, empty for random')
						.setMinValue(0)
						.setMaxValue(Math.pow(2, 32)))
				.addIntegerOption(option =>
					option.setName('steps')
						.setDescription('Steps, 1-28(50), default 28')
						.setMinValue(1)
						.setMaxValue(50))
				.addNumberOption(option =>
					option.setName('scale')
						.setDescription('Scale, 1.1-100, default 11')
						.setMinValue(1.1)
						.setMaxValue(100))
				.addStringOption(option => {
					for (const sampler of NaiHelper.defailtSamplers) {
						option.addChoices({
							name: sampler,
							value: sampler
						})
					}
					return option.setName('sampler')
						.setDescription('Sampler');
				})
				.addIntegerOption(option =>
					option.setName('batch_size')
						.setDescription('Number of image for the command')
						.setMinValue(1)
						.setMaxValue(10))
				.addStringOption(option => {
					for (const model of NaiHelper.defaultModels) {
						option.addChoices({
							name: model,
							value: model
						})
					}
					return option.setName('model')
						.setDescription('Model for other training data or weight')

				})
				.addBooleanOption(option =>
					option.setName('description')
						.setDescription('Show image description'))
		),
	async execute(interaction) {
		try {
			if (interaction.options.getSubcommand() === 'anlas') {
				var subscription = await NaiHelper.getSubscription(naiUser.token);
				await interaction.reply({ 
					content: 'Anlas: ' + (subscription.trainingStepsLeft.fixedTrainingStepsLeft + subscription.trainingStepsLeft.purchasedTrainingSteps).toString(),
					ephemeral:  !interaction.options.getBoolean('public') ?? true
				});
			}
			if (interaction.options.getSubcommand() === 'image') {
				var width = interaction.options.getInteger('width') ?? NaiHelper.persetLayout().get('np')[0];
				var height = interaction.options.getInteger('width') ?? NaiHelper.persetLayout().get('np')[1]
				const layout = interaction.options.getString('layout');
				if (layout != null) {
					if (Array.from(NaiHelper.persetLayout().keys()).includes(layout)) {
						width = NaiHelper.persetLayout().get(layout)[0];
						height = NaiHelper.persetLayout().get(layout)[1];
					} else {
						throw new Error("Wrong Layout");
					}
				}

				const naiHelper = new NaiHelper(
					naiUser,
					interaction.options.getString('prompt') ?? '',
					interaction.options.getBoolean('quality_toggle') ?? true,
					interaction.options.getString('neg_prompt'),
					width, height,
					interaction.options.getInteger('seed'),
					interaction.options.getInteger('steps'),
					interaction.options.getNumber('scale'),
					interaction.options.getString('model'),
					interaction.options.getString('sampler'),
					interaction.options.getInteger('batch_size')
				);

				if (global.pointLock && (
					naiHelper.width * naiHelper.height > 646 * 640
					|| naiHelper.steps > 28
					|| naiHelper.batch_size > 5
				)) {
					await interaction.reply({ content: 'You cannot use command over 640*640 or step > 28, batch size > 5' });
					return;
				}

				await interaction.deferReply();
				await naiHelper.fetch();

				const attachments = [];
				naiHelper.images.forEach(image =>
					attachments.push(
						new AttachmentBuilder(new Buffer.from(image.imagesBase64, "base64"), "image.png")
					));
				await interaction.editReply({ files: attachments, content: interaction.options.getBoolean('description') ? naiHelper.getDesctipion() : undefined });
			}
		} catch (error) {
			console.log(error);
			await interaction.followUp(error);
		}

	},
};