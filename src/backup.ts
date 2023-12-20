import { exec } from 'child_process'
import { PutObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { createReadStream, unlink, statSync } from 'fs'
import { filesize } from 'filesize'
import path from 'path'
import os from 'os'

import { env } from './env'

const uploadToS3 = async ({ name, path }: { name: string; path: string }) => {
  console.log(`Uploading backup ${path} to S3...`)

  const bucket = env.AWS_S3_BUCKET

  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION,
  }

  if (env.AWS_S3_ENDPOINT) {
    console.log(`Using custom endpoint: ${env.AWS_S3_ENDPOINT}`)
    clientOptions['endpoint'] = env.AWS_S3_ENDPOINT
  }

  const client = new S3Client(clientOptions)

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: name,
      Body: createReadStream(path),
    })
  )

  console.log(`Backup ${name} uploaded to S3...`)
}

const dumpToFile = async (path: string, dbUrl: string, project: string) => {
  console.log(`Dumping DB ${project} to file...`)

  await new Promise((resolve, reject) => {
    exec(`pg_dump --dbname=${dbUrl} --format=tar | gzip > ${path}`, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error, stderr: stderr.trimEnd() })
        return
      }

      // If stderr matches anything with "error" reject the promise
      const errorRegex = /error/i
      if (errorRegex.test(stderr)) {
        reject({ stderr: stderr.trimEnd() })
        return
      }

      // If stderr emitted anything log to console
      if (stderr != '') {
        console.log(`pg_dump ${project} succeeded with stderr warnings:`)
        console.log(stderr.trimEnd())
      }

      console.log(`Backup size ${project}: ${filesize(statSync(path).size)}`)

      resolve(undefined)
    })
  })

  console.log(`DB ${project} dumped to file...`)
}

const deleteFile = async (path: string) => {
  console.log(`Deleting file ${path}...`)
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      reject({ error: err })
      return
    })
    resolve(undefined)
  })
}

export const backup = async () => {
  console.log('Initiating DB backup(s)...')

  let date = new Date().toISOString()
  const timestamp = date.replace(/[:.]+/g, '-')

  const dbUrls = env.BACKUP_DATABASE_URLS.split('|')
  const projects = env.PROJECT_NAMES.split('|')

  const promises: Promise<void>[] = projects.map((project: string, index: number) => {
    const filename = `backup-${project}-${timestamp}.tar.gz`
    const filepath = path.join(os.tmpdir(), filename)

    if (!dbUrls[index]) {
      console.log('No database URL found for project: ' + project)
      return Promise.resolve()
    }

    return dumpToFile(filepath, dbUrls[index], project)
      .then(() => {
        return uploadToS3({ name: filename, path: filepath })
      })
      .then(() => {
        return deleteFile(filepath)
      })
  })

  await Promise.all(promises)

  console.log('DB backup complete...')
}
