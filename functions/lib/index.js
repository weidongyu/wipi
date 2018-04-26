// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');
// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
const path = require('path');
const os = require('os');
const fs = require('fs');
const Busboy = require('busboy');
const inspect = require('util').inspect;
// const bodyParser = require('body-parser')
const request = require("request");
admin.initializeApp();
const bucket = admin.storage().bucket();
let filename_global = 'tmp.jpg';
let piCode_global = 'MWN7SmhCUEZFmxmGULrnQriT1ub2';
const subscription_key = "eb791e1eb42e40deb503bfde4da23abd";
const sendNotification = (piCode, url) => {
    // // This registration token comes from the client FCM SDKs.
    // var registrationToken = 'YOUR_REGISTRATION_TOKEN';
    let topic = 'image';
    // See documentation on defining a message payload.
    let message = {
        data: {
            url: url,
            time: '00:00'
        },
        notification: {
            title: 'Danger!',
            body: 'Intruder detected!'
        },
        topic: piCode
    };
    // Send a message to the device corresponding to the provided
    // registration token.
    admin.messaging().send(message).then((response) => {
        // Response is a message ID string.
        console.log('Successfully sent message:', response);
    })
        .catch((error) => {
        console.log('Error sending message:', error);
    });
};
function getFaceId(image_url) {
    let params = {
        'returnFaceId': 'true',
        'returnFaceLandmarks': 'false',
        'returnFaceAttributes': '',
    };
    let face_api_url = 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/detect';
    var options = {
        url: face_api_url,
        headers: { 'Ocp-Apim-Subscription-Key': subscription_key },
        qs: params,
        json: { url: image_url }
    };
    return new Promise(function (resolve, reject) {
        // Do async job
        request.post(options, function (err, response, body) {
            if (err) {
                reject(err);
            }
            else {
                console.log("Get response: " + response.statusCode);
                console.log('faceId body:', body);
                resolve(body);
            }
        });
    });
}
function checkFaceId(faceId) {
    let face_api_url_id = 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/identify';
    let fields = {
        "personGroupId": "shadows",
        "faceIds": [
            faceId
        ],
        "maxNumOfCandidatesReturned": 1,
        "confidenceThreshold": 0.5
    };
    var options = {
        url: face_api_url_id,
        headers: { 'Ocp-Apim-Subscription-Key': subscription_key },
        json: fields
    };
    return new Promise(function (resolve, reject) {
        // Do async job
        request.post(options, function (err, response, body) {
            if (err) {
                reject(err);
            }
            else {
                console.log("Get response in checking: " + response.statusCode);
                console.log('response body:', body);
                let candidates = JSON.stringify(body[0]['candidates']);
                console.log('candidates: ', candidates);
                resolve(body[0]['candidates']);
            }
        });
    });
}
function checkAndSend(piCode, url) {
    getFaceId(url).then((faceIds) => {
        console.log("get FaceId:", faceIds);
        if (faceIds[0]) {
            checkFaceId(faceIds[0]['faceId']).then((candidates) => {
                console.log('Got checked', candidates);
                if (candidates[0]) {
                    console.log('Hit whitelist! No need to send notifications');
                }
                else {
                    sendNotification(piCode, url);
                }
            }, (err) => {
                console.log(err);
            });
        }
        else {
            sendNotification(piCode, url);
        }
    }, (err) => {
        console.log('get FaceId err:', err);
    });
}
;
exports.upload = functions.https.onRequest((req, res) => {
    if (req.method === 'POST') {
        const busboy = new Busboy({ headers: req.headers });
        // console.log('req body:', JSON.parse(req.body));
        // This object will accumulate all the uploaded files, keyed by their name
        const uploads = {};
        // This callback will be invoked for each file uploaded
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            // console.log('the file is ', file);
            filename_global = filename;
            console.log(`File [${fieldname}] filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
            file.on('data', function (data) {
                console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
            });
            file.on('end', function () {
                console.log('File [' + fieldname + '] Finished');
            });
            // Note that os.tmpdir() is an in-memory file system, so should only
            // be used for files small enough to fit in memory.
            const filepath = path.join(os.tmpdir(), filename);
            uploads[fieldname] = { file: filepath };
            console.log(`Saving '${fieldname}' to ${filepath}`);
            file.pipe(fs.createWriteStream(filepath));
        });
        busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
            console.log('Field [' + fieldname + ']: value: ' + inspect(val));
        });
        // This callback will be invoked after all uploaded files are saved.
        busboy.on('finish', () => {
            console.log('finished: ', uploads);
            fs.readdir('/tmp/', (err, files) => {
                if (!err) {
                    files.forEach(file => {
                        console.log('file under /tmp/: ', file);
                    });
                }
                else {
                    console.log(err);
                }
            });
            for (const name in uploads) {
                const upload = uploads[name];
                const file = upload.file;
                res.write(`${file}\n`);
                // fs.unlinkSync(file);
                const options = {
                    destination: '/images/' + piCode_global + '/' + filename_global
                };
                bucket.upload(file, options).then(data => {
                    fs.unlinkSync(file);
                    const file_uploaded = bucket.file('images/' + piCode_global + '/' + filename_global);
                    return file_uploaded.getSignedUrl({
                        action: 'read',
                        expires: '03-09-2491'
                    });
                }).then(url => {
                    console.log('public download url: ', url[0]);
                    checkAndSend(piCode_global, url[0]);
                }).catch(error => {
                    console.error(error);
                });
            }
            res.end();
        });
        // The raw bytes of the upload will be in req.rawBody.  Send it to busboy, and get
        // a callback when it's finished.
        busboy.end(req.rawBody);
    }
    else {
        // Client error - only support POST
        res.status(405).end();
    }
});
exports.status = functions.https.onRequest((req, res) => {
    if (req.method === 'GET') {
        // console.log(req.query);
        if (req.query.piCode) {
            // find the user id associate with pi
            let piCode = req.query.piCode;
            console.log('pi code in params: ', piCode);
            var db = admin.database();
            var ref = db.ref("/users");
            ref.once("value", function (snapshot) {
                console.log(snapshot.val());
                const users = snapshot.val();
                console.log('users: ', users);
                console.log('typeof: ', typeof (users));
                let isPaired = false;
                let leave = true;
                for (let ind in users) {
                    console.log('picode in data: ', users[ind]['piCode']);
                    if (users[ind]['piCode'] === piCode) {
                        isPaired = true;
                        if (users[ind]['leave'] === false) {
                            leave = false;
                            break;
                        }
                    }
                }
                if (isPaired) {
                    if (leave) {
                        res.write(JSON.stringify({ status: true }));
                    }
                    else {
                        res.write(JSON.stringify({ status: false }));
                    }
                    res.status(200).end();
                }
                else {
                    // the pi code has not paired with any device yet
                    // res.write('the pi has not been paired yet.');
                    res.status(401).end();
                }
            });
        }
        else {
            // res.write('Missing pi code.');
            res.status(401).end();
        }
    }
    else {
        res.status(405).end();
    }
});
//# sourceMappingURL=index.js.map