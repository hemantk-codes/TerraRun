import { User } from '../models/index.js'
import { ApiError } from '../utils/apiError.js'
import { sanitizeUser } from '../utils/sanitizeUser.js'
import cloudinary from '../config/cloudinary.js'

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'terrarun/avatars',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      },
    )

    stream.end(buffer)
  })
}

export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please select an image.')
    }

    const result = await uploadToCloudinary(req.file.buffer)

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatarUrl: result.secure_url },
      { new: true, runValidators: true },
    )

    if (!user) {
      throw new ApiError(404, 'User not found.')
    }

    res.status(200).json({
      user: sanitizeUser(user),
    })
  } catch (err) {
    next(err)
  }
}