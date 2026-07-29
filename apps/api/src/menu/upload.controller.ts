import { Controller, Post, Body, UseGuards, BadRequestException } from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"

@ApiTags("upload")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("upload")
export class UploadController {
  private s3 = new S3Client({
    region: process.env.AWS_REGION ?? "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  })

  @Post("presign")
  @ApiOperation({ summary: "Get S3 presigned URL for image upload" })
  async getPresignedUrl(
    @Body("filename") filename: string,
    @Body("contentType") contentType: string,
  ) {
    if (!filename || !contentType) throw new BadRequestException("filename and contentType required")
    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(contentType)) throw new BadRequestException("Only jpeg/png/webp allowed")

    const bucket = process.env.S3_BUCKET_NAME
    if (!bucket) throw new BadRequestException("S3 not configured")

    const ext = filename.split(".").pop() ?? "jpg"
    const key = `menu-images/${randomUUID()}.${ext}`

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 })
    const publicUrl = `https://${bucket}.s3.${process.env.AWS_REGION ?? "ap-south-1"}.amazonaws.com/${key}`

    return { uploadUrl: url, publicUrl, key }
  }
}
