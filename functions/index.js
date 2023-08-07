/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.scheduledTweet = onSchedule("every day 19:42", async (event) => {
  require("dotenv").config();

  const { TwitterApi } = require("twitter-api-v2");
  const axios = require("axios");
  const cheerio = require("cheerio");
  const pretty = require("pretty");
  const fs = require("fs");
  const path = require("path");

  const manga_url = "https://mangareader.to/random";

  async function downloadImage(url) {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const pathToSaveImage = path.resolve("/tmp", "image.jpg");

    response.data.pipe(fs.createWriteStream(pathToSaveImage));

    return new Promise((resolve, reject) => {
      response.data.on("end", () => resolve());
      response.data.on("error", () => reject());
    });
  }

  const getManga = async () => {
    const { data } = await axios.get(manga_url);
    const $ = cheerio.load(data);

    let title = $("head title").text();
    let title_words = title.split(" ");
    title_words.splice(-2);
    title = title_words.join(" ");

    let image = $(".manga-poster img").attr("src");

    await downloadImage(image)
      .then(() => console.log("Image downloaded successfully!"))
      .catch((err) =>
        console.error("An error occurred while downloading image.", err)
      );

    let description = $("head meta[name=description]").attr("content");

    return [title, description];
  };

  const client = new TwitterApi({
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET,
  });

  const v2Client = client.v2;
  const v1Client = client.v1;

  const postTweet = async () => {
    const data = await getManga();

    const title = data[0];
    const description = data[1];

    const mediaId = await v1Client.uploadMedia("/tmp/image.jpg");

    const text = `${title}
    
${description}`;

    if (text.length > 280) {
      let number_of_tweets = text.length / 280;
      let tweets = [];
      for (var i = 0; i < number_of_tweets; i++) {
        tweets.push(text.slice(i * 280, (i + 1) * 280));
      }

      await v2Client.tweetThread([
        { text: tweets[0], media: { media_ids: [mediaId] } },
        tweets[1],
      ]);
    } else {
      await v2Client.tweet({
        text: text,
        media: { media_ids: [mediaId] },
      });
    }
  };

  await postTweet();
});
