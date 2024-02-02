const sharp = require('sharp');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

const imageWidthSize = 300;

exports.handler = async (event, context) => {

    const bucket = event.Records[0].s3.bucket.name;
    
    //Regex replaces the + with a space
    const { key } = event.Records[0].s3.object;

    if(!key) {
        console.error(`S3 Key ${key} is undefined.`);
        return {
            statusCode: 400,
            body: JSON.stringify({error: `S3 Key ${key} is undefined.`}),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }

    //Check if image has already been resized to avoid infinite processing
    if(key.includes('_resized')) {
        return {
            statusCode: 204,
            body: JSON.stringify({message: 'Image is already processed. Exiting.'}),
            headers: {
                'Content-Type' : 'application/json'
            }
        };
    }

    try {
        //Download the image from the S3
        const originalImage = await s3.getObject({Bucket: bucket, Key: key }).promise(); 

        //Download image Metadata
        const imageMetadata = await sharp(originalImage.Body).metadata();

        console.log(imageMetadata);

        //Check if the width is 'imageWidthSize' pixels or less
        if(!imageMetadata || !imageMetadata.width) {
            console.log('Image is lacking necessary metadata');
            return {
                statusCode: 400,
                body: JSON.stringify({message: 'Image is lacking necessary metadata'}),
                headers: {
                    'Content-Type' : 'application/json'
                }
            };;
        }

        const imageWidth = parseInt(imageMetadata.width, 10);
        if(imageWidth <= imageWidthSize){
            console.log('Image is already proper size.');
            return {
                statusCode: 400,
                body: JSON.stringify({message: 'Image is already proper size.'}),
                headers: {
                    'Content-Type' : 'application/json'
                }
            };;
        }

        //Resize the image
        const resizedImage = await sharp(originalImage.Body)
            .resize({ width:imageWidthSize})
            .toBuffer();

        //Upload the resized image
        await s3.putObject({
            Bucket: bucket,
            Key: key.replace('.', '_resized.'),
            Body: resizedImage,
        }).promise();

        console.log(`Resized Image ${key.replace('.', '_resized.')} has been uploaded`);
        return {
            statusCode: 200,
            body: JSON.stringify({message: `Resized Image ${key.replace('.', '_resized.')} has been uploaded`}),
            headers: {
                'Content-Type' : 'application/json'
            }
        }
    } catch(error) {
        console.error('Error processing image: ', error);
        return {
            statusCode: 500,
            body: JSON.stringify({error: 'Internal Server Error'}),
            headers: {
                'Content-Type' : 'application/json'
            }
        };
    }
};