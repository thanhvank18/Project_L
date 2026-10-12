export class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message = code) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export { HttpError as ApiError }
