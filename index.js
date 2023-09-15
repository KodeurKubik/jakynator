const { Client, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Aki, answers } = require('aki-api');
const config = require('./config');
const client = new Client({ intents: [] });
client.config = config;

function getActionRows(uid, array, guess = 0) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-a-${answers.Yes}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(array[0]),
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-a-${answers.No}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(array[1]),
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-a-${answers.DontKnow}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(array[2]),
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-a-${answers.Probably}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(array[3]),
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-a-${answers.ProbablyNot}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(array[4]),
      ),
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-back`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Back')
          .setDisabled(guess == 0)
          .setEmoji('🔙'),
        new ButtonBuilder()
          .setCustomId(`aki-${uid}-stop`)
          .setStyle(ButtonStyle.Danger)
          .setLabel('Stop')
          .setEmoji('🛑'),
      )
  ]
}

/** @type {Map<String, Aki>} games */
const games = new Map();

client.on('ready', async () => {
  config.console.success(`Logged in as @${client.user.tag}`);

  client.application.commands.set([
    new SlashCommandBuilder()
      .setName(config.name.toLowerCase())
      .setDescription(`Pense à quelque chose, je vais le trouver !`)
      .setDMPermission(true)
      .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  ]);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const cmd = interaction.commandName;

    if (cmd == config.name.toLowerCase()) {
      await interaction.deferReply({ ephemeral: false });

      if (games.get(interaction.user.id)) {
        let aki = games.get(interaction.user.id);

        await interaction.editReply({
          embeds: [
            config.embed(client)
              .setDescription(`## ${aki.question}`)
              .setFooter({ text: `Question ${aki.countr}` })
          ], components: getActionRows(interaction.user.id, aki.answers, aki.countr)
        });
      }

      else {
        let aki = new Aki({ region: interaction.options.getString('region') || 'fr', childMode: false, proxy: undefined });
        aki.countr = 0;
        let get = await aki.start();
        games.set(interaction.user.id, aki);

        await interaction.editReply({
          embeds: [
            config.embed(client)
              .setDescription(`## ${get.question}`)
              .setFooter({ text: `Question ${aki.countr}` })
          ], components: getActionRows(interaction.user.id, get.answers, aki.countr)
        })
      }
    }
  }

  else if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId.startsWith(`aki`)) {
      let [_, uid, action, val] = customId.split('-');

      if (uid != interaction.user.id) return await interaction.reply({
        ephemeral: true,
        embeds: [
          config.embed(client)
            .setColor('Red')
            .setDescription('Ce n\'est pas votre partie !')
        ]
      });

      await interaction.deferUpdate({ fetchReply: true });

      let aki = games.get(interaction.user.id);
      if (!aki) return await interaction.editReply({
        ephemeral: true,
        embeds: [
          config.embed(client)
            .setColor('Red')
            .setDescription('Vous n\'avez aucune partie lancée !')
        ], components: [],
      });

      if (action == 'win') {
        let embed = new EmbedBuilder(interaction.message.embeds[0]);
        embed.setThumbnail(embed.data.image.url || null);
        embed.setImage(null);
        embed.setTitle('Super ! J\'ai vu juste !');
        embed.setFooter({ text: "J'adore jouer avec toi !" });

        await interaction.editReply({
          embeds: [embed],
          components: []
        });
        games.delete(interaction.user.id);
      }

      else if (action == 'continue') {
        if (aki.firstDone && aki.currentStep >= 99) {
          await interaction.editReply({
            embeds: [
              config.embed(client)
                .setTitle('Je n\'ai pas réussi à trouver à quoi tu pensais !')
                .setDescription(`## Bien joué !\n\n> Réessaye si tu veux !`)
            ], components: []
          })
        }

        else {
          await aki.step(0);
          let get = await aki.back();

          await interaction.editReply({
            embeds: [
              config.embed(client)
                .setDescription(`## ${get.question}`)
                .setFooter({ text: `Question ${aki.countr}` })
            ], components: getActionRows(interaction.user.id, get.answers, aki.countr)
          })
        }
      }

      else if (action == 'a') {
        let get = await aki.step(val)
        aki.countr++;
        aki.question = get.question;
        aki.answers = get.answers;

        if ((!aki?.firstDone && (aki.progress >= 70 || aki.currentStep >= 78)) || (aki?.firstDone && aki.currentStep >= 50) || (aki.firstDone && (aki.currentStep >= 99))) {
          aki.firstDone = true;
          let result = await aki.win();

          if (result.countr == 0) {
            await interaction.editReply({
              embeds: [
                config.embed(client)
                  .setDescription(`## Bien joué, je n'ai pas trouvé !`)
              ], components: []
            });
            games.delete(interaction.user.id);
          }

          else {
            let g = result.guesses[0];
            await interaction.editReply({
              embeds: [
                config.embed(client)
                  .setTitle('Je crois que j\'ai trouvé ! Ai-je correct ?')
                  .setDescription(`## ${g.name}\n> ${g.description}\nClassement **#${g.ranking}**`)
                  .setImage(g.absolute_picture_path)
              ], components: [
                new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder()
                      .setCustomId(`aki-${uid}-win`)
                      .setStyle(ButtonStyle.Primary)
                      .setLabel('Oui'),
                    new ButtonBuilder()
                      .setCustomId(`aki-${uid}-continue`)
                      .setStyle(ButtonStyle.Primary)
                      .setLabel('Non'),
                  )
              ]
            })
          }
        }

        else {
          await interaction.editReply({
            embeds: [
              config.embed(client)
                .setDescription(`## ${get.question}`)
                .setFooter({ text: `Question ${aki.countr}` })
            ], components: getActionRows(interaction.user.id, get.answers, aki.countr)
          })
        }
      }

      else if (action == 'back') {
        let get = await aki.back();
        aki.countr--;

        await interaction.editReply({
          embeds: [
            config.embed(client)
              .setDescription(`> Retour en arrière\n## ${get.question}`)
              .setFooter({ text: `Question ${aki.countr}` })
          ], components: getActionRows(interaction.user.id, get.answers, aki.countr)
        })
      }

      else if (action == 'stop') {
        await interaction.editReply({
          embeds: [
            config.embed(client)
              .setDescription(`## Game stoppé`)
              .setFooter({ text: `Question ${aki.countr}` })
          ]
        })

        games.delete(interaction.user.id);
      }
    }
  }
})


client.login(config?.TOKEN);

process.on("unhandledRejection", (r) => console.log(r));
process.on("uncaughtException", (r) => console.log(r));
process.on("uncaughtExceptionMonitor", (r) => console.log(r));
process.on("warning", (r) => console.log(r));
process.on("exit", (r) => console.log(r));