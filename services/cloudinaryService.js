const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

class CloudinaryService {
  /**
   * Upload image to Cloudinary
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} folder - Folder name in Cloudinary (optional)
   * @param {string} publicId - Public ID for the image (optional)
   * @returns {Promise<Object>} Upload result with URL and public ID
   */
  static async uploadImage(imageBuffer, folder = 'profile-pictures', publicId = null) {
    try {
      // Convert buffer to stream
      const stream = Readable.from(imageBuffer);
      
      // Upload options
      const uploadOptions = {
        folder: folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      };

      // Add public ID if provided
      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.bytes
              });
            }
          }
        );

        stream.pipe(uploadStream);
      });
    } catch (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Delete image from Cloudinary
   * @param {string} publicId - Public ID of the image to delete
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Update image in Cloudinary (delete old and upload new)
   * @param {Buffer} newImageBuffer - New image buffer
   * @param {string} oldPublicId - Old image public ID to delete
   * @param {string} folder - Folder name in Cloudinary
   * @returns {Promise<Object>} Upload result
   */
  static async updateImage(newImageBuffer, oldPublicId, folder = 'profile-pictures') {
    try {
      // Delete old image if it exists
      if (oldPublicId) {
        await this.deleteImage(oldPublicId);
      }

      // Upload new image
      return await this.uploadImage(newImageBuffer, folder);
    } catch (error) {
      throw new Error(`Failed to update image: ${error.message}`);
    }
  }
}

module.exports = CloudinaryService; 