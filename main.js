const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const fs = require('fs');

const axios = require("axios");
const cheerio = require("cheerio");
const mainUrl = `https://www.reddit.com/r/science/new/`;
const factUrl = `https://randstuff.ru/fact/`;
const newsRefreshRate = 300 * 1000;
const timeRefreshRate = 60 * 1000;
const lectureMaxMin = 300;
const lectureMinMin = 30;
const breakTime = 600 * 1000;
const breakTimeMins = 10;
const lastBreakTime = 180 * 1000;
const hourInMinutes = 60;
const professorWaitingTimeMins = 15;

// Secondary voice chat for Professor
let musicVoiceChannelName = 'Актовый Зал';
// Main voice chat for Professor
let targetVoiceChannelName = 'Аудитория';
// Main chat for Professor
let targetChannelName = 'радиорубка';
// News chat for Professor
let newsChannelName = 'телеграф';
// Schedule chat for Professor
let scheduleChannelName = 'расписание';
// Voice controller
let dispatcher;
// Is in voice now checker
let isInVoice = false;
// Begin of Lectures
let perigee = "9:00";
// Perigee in mins
let perigeeMinutes = 540;
// Is news initialized
let isNewsInit = false;
// Professor's status
const professorStatuses = { "classic": 1, "scheduling": 2, "lecture": 3 };
let currentStatus = professorStatuses.classic;
// Schedule
let schedule = '';
// Schedule Playlist
let schedulePl = '';
// Discipline counter
let disciplineNum = 0;
// Discipline minutes
let disciplineMin = 0;
// Play stack
let playstack = [];
// Play stack non-lecture
let playstackCustom = [];
// Array with classic pieces
var arr = require('./array').arr;

// Professor login
client.login('BOT_TOKEN');

// OnReady information post and init-request to /science subreddit
client.once('ready', () => {

  currentTime();
  parseWelcomeFact();
  parseNews();

});

// Sending request to random-fact website
function parseWelcomeFact() {

  axios
    .get(factUrl)
    .then((response) => {
      scrapFactHtml(response.data);
    })
    .catch((err) => {
      console.log('Error when loading random fact.');
      client.channels.cache.find(channel => channel.name === targetChannelName)
        .send('Здравствуйте! В данный момент, к сожалению, явился без интересных фактов.');
    });

}

// Scrapping&Posting random fact from request
const scrapFactHtml = (html) => {

  const $ = cheerio.load(html);
  var fact = $('#fact').text(); // Random fact
  fact = fact.substring(0, fact.length - 15);

  // Reaction to last fact
  client.channels.cache.find(channel => channel.name === targetChannelName)
    .send('Здравствуйте! Интересный факт: ' + '\n' + fact).then(function (message) {

      message.react('💡')

    }).catch(function () {

      console.log("Error when reacting to message.");

    });

}

// Sending request to /science subreddit
function parseNews() {

  axios
    .get(mainUrl)
    .then((response) => {
      scrapRedditHtml(response.data);
    })
    .catch((err) => {
      if (!isNewsInit) {
        isNewsInit = true;
        parseNews();
      } else {
        console.log('Error when loading science news.');
      }
    });

}

// Scrapping tag and text from request
const scrapRedditHtml = (html) => {

  const $ = cheerio.load(html);
  var title = $('._2VqfzH0dZ9dIl3XWNxs42y').first().text(); // Tag info
  var data = $('._eYtD2XCVieq6emjKBH3m').first().text(); // Text info
  postNews(title + '\n' + data);

}

// Loop for parsing news from /science subreddit
setInterval(parseNews, newsRefreshRate);

function postNews(post) {

  // Grab news only when Professor is free
  if (isInVoice || currentStatus == professorStatuses.lecture) {

    return;

  }

  // Reading file with last post
  fs.readFile('news.txt', 'utf8', (err, data) => {

    if (err) {
      console.error(err)
      return
    }

    var text = data.split('\n')[1];

    // If last post is differ from current - send message to discord and rewrite file
    if (post.split('\n')[1] !== text) {

      client.channels.cache.find(channel => channel.name === newsChannelName).send(post);
      fs.writeFile('news.txt', post, function (err) {
        if (err) return console.log('Error on FW news.');
        console.log('News refreshed.');
      });

      // Otherways - log and wait next refresh
    } else {

      console.log('No news at the moment.');

    }

  });

}

// Grab lectures perigee
getPerigee();

function getPerigee() {

  fs.readFile('options.txt', 'utf8', (err, data) => {

    if (err) {
      console.error(err)
      return
    }

    perigee = data;
    perigeeMinutes = (data.split(":")[0] * hourInMinutes) + parseInt(data.split(":")[1]);

    console.log('Loaded lectures perigee time - ' + perigee + ' . In mins -> ' + perigeeMinutes);

  });

}

//Grab schedule playlist
loadSchedulePlaylist();

function loadSchedulePlaylist() {

  fs.readFile('schedule_pl.txt', 'utf8', (err, data) => {

    if (err) {
      console.error(err)
      return
    }

    schedulePl = data;
    console.log('Schedule PL loaded.');

    scheduleToStack(schedulePl);

  });

}

// Grab schedule
loadSchedule();

function loadSchedule() {

  fs.readFile('schedule.txt', 'utf8', (err, data) => {

    if (err) {
      console.error(err)
      return
    }

    schedule = data;
    console.log('Schedule loaded.');

  });

}

// Parse playstack from schedule
function scheduleToStack(data) {

  playstack = [];

  // Trim both appendix elements in playstack array
  var playstackArr = data.split('<discipline>');
  playstackArr.pop();
  playstackArr.shift();

  for (let value of playstackArr) {

    // Trim discipline array
    var disciplineArr = value.split('\n');
    disciplineArr.shift();
    disciplineArr.pop();

    for (let dValue of disciplineArr) {

      playstack.push(dValue);

    }

    playstack.push(arr[Math.floor(Math.random() * arr.length)]);

  }

  console.log(playstack);

}

// Parse message from schedule
function scheduleToMessage(data) {

  var message = '';

  // Trim both appendix elements in schedule array
  var scheduleArr = data.split('<discipline>');
  scheduleArr.pop();
  scheduleArr.shift();

  var disciplineCounter = 1;
  var contentCounter = 1;

  for (let value of scheduleArr) {

    // Trim discipline array, grab duration
    var disciplineArr = value.split('\n');
    disciplineArr.shift();
    disciplineArr.pop();
    var duration = disciplineArr.pop();

    for (let dValue of disciplineArr) {

      if (contentCounter === 1) {

        message += '\n\n' + disciplineCounter + '. ' + dValue +
          '\n---\n';
        contentCounter++;

      } else {

        message += dValue + '\n';

      }

    }

    message += "Длительность дисциплины: ~" + Math.floor(duration) + ' минут.';
    contentCounter = 1;
    disciplineCounter++;

  }

  client.channels.cache.find(channel => channel.name === scheduleChannelName).send(
    'Расписание на ' + perigee +
    message + '\n\n------------------------------------------------\n'
  );

}

// Loop for handling current time to compare with perigee
setInterval(currentTime, timeRefreshRate);

async function currentTime() {

  if (currentStatus !== professorStatuses.lecture && !isInVoice) {

    var now = new Date();
    var totalMins = (now.getHours() * hourInMinutes) + now.getMinutes();
    console.log(perigeeMinutes + '-' + (perigeeMinutes + professorWaitingTimeMins) + ' >>> ' + totalMins);

    if (totalMins >= perigeeMinutes && totalMins <= (perigeeMinutes + professorWaitingTimeMins)) {

      console.log('Lectures are begin.');
      client.channels.cache.find(channel => channel.name === targetChannelName)
        .send('Занятия начались. Присаживайтесь поудобнее!');
      currentStatus = professorStatuses.lecture;

      // Pin Professor to lecture channel
      const connection = await client.channels.cache
        .find(channel => channel.name === targetVoiceChannelName).join();

      dispatcher = connection.play(ytdl(playstack.shift(), { filter: 'audioonly' }));
      setDispatcherOnFinish(connection);

    }

  }

}

// Finish event of dispatcher
async function setDispatcherOnFinish(con) {

  dispatcher.on('finish', async () => {

    if (playstack.length > 0) {

      console.log(playstack);

      // Check if is break now
      var videoLink = playstack.shift();

      if (arr.includes(videoLink)) {

        if (playstack.length > 1) {

          client.channels.cache.find(channel => channel.name === targetChannelName)
            .send('Объявлен перерыв в ' + breakTimeMins + ' минут.');

        } else {

          client.channels.cache.find(channel => channel.name === targetChannelName)
            .send('Занятия окончены. Приходите завтра!');

          dispatcher = con.play(ytdl(videoLink, { filter: 'audioonly' }));
          setDispatcherOnFinish(con);

          // Last break
          setTimeout(keepLecture, lastBreakTime, con);

          return;

        }

        setTimeout(keepLecture, breakTime, con);

      }

      dispatcher = con.play(ytdl(videoLink, { filter: 'audioonly' }));
      setDispatcherOnFinish(con);

    }

  });

}

// Skip break and keep lectures
function keepLecture(con) {

  if (playstack.length > 0) {

    console.log(playstack);

    client.channels.cache.find(channel => channel.name === targetChannelName)
      .send('Занятия продолжаются.');

    dispatcher = con.play(ytdl(playstack.shift(), { filter: 'audioonly' }));
    setDispatcherOnFinish(con);

  } else {

    client.channels.cache.find(channel => channel.name === targetChannelName)
      .send('Аудитория закрывается.');

    dispatcher.destroy();

    currentStatus = professorStatuses.classic;

  }

}

function setDispatcherOnFinishCustom(con) {

  dispatcher.on('finish', () => {

    // Check on empty queue
    if (playstackCustom.length == 0) {

      isInVoice = false;

    } else {

      dispatcher = con.play(ytdl(playstackCustom.shift(), { filter: 'audioonly' }));
      setDispatcherOnFinishCustom(con);

    }

  });

}

//
//
// Main listener for user messages
//
//

client.on('message', async message => {

  if (message.content.split(" ")[0] === '!play' && currentStatus === professorStatuses.classic) {

    if (message.content.split(" ")[1] == undefined) {

      message.reply("Некорректная ссылка.");
      return;

    }

    // Add video to stack
    playstackCustom.push(message.content.split(" ")[1]);

    var queueNum = playstackCustom.length;
    if (isInVoice)
      queueNum++;

    message.reply("Видео добавлено в очередь (" + queueNum + ").");
    console.log(playstackCustom);

    // Play video if Professor free at the moment
    if (!isInVoice) {

      isInVoice = true;
      const connection = await client.channels.cache
        .find(channel => channel.name === musicVoiceChannelName).join();

      dispatcher = connection.play(ytdl(playstackCustom.shift(), { filter: 'audioonly' }));
      setDispatcherOnFinishCustom(connection);

    }

  }

  // Pause last video
  else if (message.content === '!pause' && currentStatus === professorStatuses.classic) {

    dispatcher.pause();

  }

  // Resume last video
  else if (message.content === '!resume' && currentStatus === professorStatuses.classic) {

    dispatcher.resume();

  }

  // Stop all videos
  else if (message.content === '!stop' && currentStatus === professorStatuses.classic) {

    playstackCustom = [];
    isInVoice = false;
    dispatcher.destroy();

  }

  // Skip current video
  else if (message.content === '!skip' && currentStatus === professorStatuses.classic) {

    if (playstackCustom.length == 0) {

      isInVoice = false;
      dispatcher.destroy();

    } else {

      const connection = await client.channels.cache
        .find(channel => channel.name === musicVoiceChannelName).join();

      dispatcher = connection.play(ytdl(playstackCustom.shift(), { filter: 'audioonly' }));
      setDispatcherOnFinishCustom(connection);

    }

  }

  // Set new time for lecture reading
  else if (message.content.split(' ')[0] === '!perigee' && currentStatus === professorStatuses.classic) {

    var data = message.content.split(' ')[1];

    perigee = data;
    perigeeMinutes = (data.split(":")[0] * hourInMinutes) + parseInt(data.split(":")[1]);

    message.reply('Назначено новое время для начала учебного дня: ' + data);

    fs.writeFile('options.txt', data, function (err) {
      if (err) return console.log('Error when setting new perigee.');
      console.log('Options refreshed.');
    });

  }

  // Set new schedule before perigee comes
  else if (message.content === '!ss' && currentStatus === professorStatuses.classic) {

    disciplineNum = disciplineNum + 1;
    schedule = '<discipline>';
    schedulePl = '<discipline>';
    currentStatus = professorStatuses.scheduling;
    message.reply('Планирование нового расписания.\nУкажите название дисциплины.');

  }

  // Clear current schedule
  else if (message.content === '!cs' && currentStatus === professorStatuses.scheduling) {

    disciplineMin = 0;
    disciplineNum = 0;
    schedule = '';
    schedulePl = '';
    currentStatus = professorStatuses.classic;
    message.reply('Расписание очищено.\nПожалуйста, составьте новое расписание.');

  }

  // Discipline name
  else if (message.content.split(" ")[0] === '!dn' && currentStatus === professorStatuses.scheduling) {

    var data = message.content.substring(4, message.content.length);

    schedule = schedule + '\n';
    schedule = schedule + data;

    message.reply('Дисциплина №' + disciplineNum + ": " + data +
      '\n' + 'Заполните дисциплину материалами для проигрывания (от ' + lectureMinMin + ' до ' +
      lectureMaxMin + ' минут).');

  }

  // Discipline content
  else if (message.content.split(" ")[0] === '!dc' && currentStatus === professorStatuses.scheduling) {

    var data = message.content.split(" ")[1];

    let info = await ytdl.getInfo(data);
    let contentLength = info['videoDetails']['lengthSeconds'] / hourInMinutes;
    let title = info['videoDetails']['title'];

    if (disciplineMin + contentLength > lectureMaxMin) {

      message.reply('Пожалуйста, не превышайте границы в ' + lectureMaxMin +
        ' минут для одной дисциплины.');
      return;

    }

    schedulePl = schedulePl + '\n';
    schedulePl = schedulePl + data;

    schedule = schedule + '\n';
    schedule = schedule + title;

    disciplineMin = disciplineMin + contentLength;

    message.reply('Материал успешно добавлен.' + '\n' +
      'Суммарное количество минут текущей дисциплины: ' + Math.floor(disciplineMin) + '.');

  }

  // Assure discipline
  else if (message.content === '!ac' && currentStatus === professorStatuses.scheduling) {

    if (disciplineMin > lectureMinMin) {

      schedule = schedule + '\n';
      schedule = schedule + disciplineMin;

      message.reply('Дисциплина №' + disciplineNum + ' успешно добавлена в расписание.' +
        '\n' + 'Укажите название новой дисциплины или утвердите расписание при минимум двух дисциплинах.');

      disciplineNum = disciplineNum + 1;
      disciplineMin = 0;

      schedule = schedule + '\n';
      schedulePl = schedulePl + '\n';
      schedule = schedule + '<discipline>';
      schedulePl = schedulePl + '<discipline>';

    } else {

      message.reply('Пожалуйста, добавьте материалов для дисциплины минимум на ' + lectureMinMin
        + ' минут.');

    }

  }

  // Push schedule
  else if (message.content === '!push' && currentStatus === professorStatuses.scheduling) {

    if (disciplineNum > 2) {

      schedule = schedule + '\n';
      schedule = schedule + disciplineMin;

      fs.writeFile('schedule.txt', schedule, function (err) {
        if (err) return console.log('Error when FW shedule.');
        console.log('Schedule refreshed.');
      });

      fs.writeFile('schedule_pl.txt', schedulePl, function (err) {
        if (err) return console.log('Error when FW schedule PL.');
        console.log('Schedule playlist refreshed.');
      });

      currentStatus = professorStatuses.classic;
      message.reply('Расписание успешно утверждено.');

      console.log(schedule);

      scheduleToMessage(schedule);
      scheduleToStack(schedulePl);

    } else {

      message.reply('Для занятий необходимо минимум 2 дисциплины.');

    }

  }

  else if (message.content === '!help') {

    message.reply('Список команд:\n' +
      '----------\n' +
      'Проигрывание кастомных материалов.\n' +
      '!play <link> - Добавить материал для проигрывания.\n' +
      '!pause - Приостановить проигрывание.\n' +
      '!resume - Продолжить проигрывание.\n' +
      '!stop - Остановить проигрывание и удалить все материалы в очереди.\n' +
      '!skip - Перейти к следующему материалу.\n\n' +
      'Кастомизация расписания.\n' +
      '!ss - Приступить к формированию нового расписаия.\n' +
      '!dn <name> - Указать название дисциплины.\n' +
      '!dc <link> - Добавить материалы к дисциплине.\n' +
      '!ac - Утвердить дисциплину.\n' +
      '!push - Утвердить расписание.\n' +
      '!cs - Сбросить несформированное расписание.\n' +
      '!perigee <hh:mm> - Задать начало учебного дня.').then(function (message) {

        message.react('💡')

      }).catch(function () {

        console.log("Error when reacting to message.");

      });

  }

});
