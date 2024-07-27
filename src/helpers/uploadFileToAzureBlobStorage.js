// uploadFileToAzureBlobStorage.js

const { BlobServiceClient } = require('@azure/storage-blob');

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;

// Function to upload a file to Azure Blob Storage
async function uploadFileToAzureBlobStorage(file) {
    try {
        // Create a new BlobServiceClient
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

        // Get a reference to a container
        const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

        //
        const bufferContent = Buffer.from(file.Content, 'base64');

        // Create a unique name for the blob
        const uniqueBlobName = `${Date.now()}-${file.Name}`;

        // Get a block blob client
        const blockBlobClient = containerClient.getBlockBlobClient(uniqueBlobName);

        // Upload the file to Azure Blob Storage
        await blockBlobClient.uploadData(bufferContent, {
            blobHTTPHeaders: {
                blobContentType: file.ContentType,
            },
        });

        // Return an object with the URL, fileName, and contentType of the uploaded blob
        return {
            Content: blockBlobClient.url,
            Name: file.Name,
            ContentType: file.ContentType,
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

module.exports = {
    uploadFileToAzureBlobStorage,
};
