require('dotenv').config();
const chalk = require('chalk');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'Jakynator', // Don't put spaces!!
    TOKEN: process.env.TOKEN,
    console: {
        log: (...args) => console.log(...args),
        warn: (...args) => console.warn(chalk.yellow(...args)),
        error: (...args) => console.error(...args),
        success: (...args) => console.log(chalk.green(...args)),
        cyan: (...args) => console.log(chalk.cyan(...args)),
    },
    color: '#b8957d',
    embed: (client) => new EmbedBuilder()
        .setAuthor({ name: `Jakynator`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp(Date.now())
        .setColor('#b8957d')
}