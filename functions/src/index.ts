

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


admin.initializeApp();


const bucket = admin.storage().bucket();
let filename_global = 'tmp.jpg';
let uid_global = 'MWN7SmhCUEZFmxmGULrnQriT1ub2';

const sendNotification = (uid, url) => {
    // // This registration token comes from the client FCM SDKs.
    // var registrationToken = 'YOUR_REGISTRATION_TOKEN';

    let topic = 'image';

    // See documentation on defining a message payload.
    let message = {
        data: {
            score: '850',
            time: '2:45'
        },
        notification:{
            title: 'Danger!',
            body: 'Intruder detected!'
        },
        topic: topic
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


exports.upload = functions.https.onRequest((req, res) => {
    if (req.method === 'POST') {

        console.log('req: ', req);

        console.log('req headers: ', req.headers);
        // let headers_json = JSON.parse(req.headers);
        // uid_global = headers_json.uid;
        // console.log('uid from headers', uid_global);
        const busboy = new Busboy({ headers: req.headers });
        // This object will accumulate all the uploaded files, keyed by their name
        const uploads = {};

        // This callback will be invoked for each file uploaded
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

            // console.log('the file is ', file);
            filename_global = filename;
            console.log(`File [${fieldname}] filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
            // Note that os.tmpdir() is an in-memory file system, so should only
            // be used for files small enough to fit in memory.
            const filepath = path.join(os.tmpdir(), filename);
            uploads[fieldname] = { file: filepath };
            console.log(`Saving '${fieldname}' to ${filepath}`);
            file.pipe(fs.createWriteStream(filepath));

        });

        // This callback will be invoked after all uploaded files are saved.
        busboy.on('finish', () => {
            console.log('finished: ', uploads);
            fs.readdir('/tmp/', (err, files) => {
                if(!err) {
                    files.forEach(file => {
                        console.log('file under tmp: ',file);
                    });
                }else{
                    console.log(err);
                }
            });

            for (const name in uploads) {
                const upload = uploads[name];
                const file = upload.file;
                res.write(`${file}\n`);
                // fs.unlinkSync(file);

                const options = {
                    destination: '/images/'+ uid_global +'/' + filename_global
                };

                bucket.upload(file, options).then(data => {
                    fs.unlinkSync(file);

                    const file_uploaded = bucket.file('/images/'+ uid_global +'/' + filename_global);
                    sendNotification(uid_global, 'url goes here');
                    return file_uploaded.getSignedUrl({
                        action: 'read',
                        expires: '03-09-2491'
                    })
                }).then(url => {
                    console.log(url);
                }).catch(error => {
                    console.error(error);
                });

            }



            res.end();
        });

        // The raw bytes of the upload will be in req.rawBody.  Send it to busboy, and get
        // a callback when it's finished.
        busboy.end(req.rawBody);
    } else {
        // Client error - only support POST
        res.status(405).end();
    }
});

exports.uploadTest = functions.https.onRequest((req, res) => {
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

            file.on('data', function(data) {
                console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
            });

            file.on('end', function() {
                console.log('File [' + fieldname + '] Finished');
            });

            // Note that os.tmpdir() is an in-memory file system, so should only
            // be used for files small enough to fit in memory.
            const filepath = path.join(os.tmpdir(), filename);
            uploads[fieldname] = { file: filepath };
            console.log(`Saving '${fieldname}' to ${filepath}`);
            file.pipe(fs.createWriteStream(filepath));

        });

        busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
            console.log('Field [' + fieldname + ']: value: ' + inspect(val));
        });

        // This callback will be invoked after all uploaded files are saved.
        busboy.on('finish', () => {
            console.log('finished: ', uploads);
            fs.readdir('/tmp/', (err, files) => {
                if(!err) {
                    files.forEach(file => {
                        console.log('file under /tmp/: ',file);
                    });
                }else{
                    console.log(err);
                }
            });

            for (const name in uploads) {
                const upload = uploads[name];
                const file = upload.file;
                res.write(`${file}\n`);
                // fs.unlinkSync(file);

                const options = {
                    destination: '/images/'+ uid_global +'/' + filename_global
                };

                bucket.upload(file, options).then(data => {
                    fs.unlinkSync(file);

                    const file_uploaded = bucket.file('images/'+ uid_global +'/' + filename_global);


                    file_uploaded.getMetadata().then(results =>{
                        const metadata = results[0];
                        console.log('metadata: ', metadata);
                    });


                    return file_uploaded.getSignedUrl({
                        action: 'read',
                        expires: '03-09-2491'
                    })
                }).then(url => {

                    console.log(url[0]);
                    sendNotification(uid_global, url[0]);
                }).catch(error => {
                    console.error(error);
                });
            }

            res.end();
        });

        // The raw bytes of the upload will be in req.rawBody.  Send it to busboy, and get
        // a callback when it's finished.
        busboy.end(req.rawBody);
    } else {
        // Client error - only support POST
        res.status(405).end();
    }
});




