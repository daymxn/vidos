class ApplicationError extends Error {
    constructor(public message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends ApplicationError {
    constructor(public message: string) {
        super(message);
    }
}

class AlreadyExistsError extends ApplicationError {
    constructor(public message: string) {
        super(message);
    }
}

class IOError extends ApplicationError {
    constructor(public message: string) {
        super(message);
    }
}

class ValidationError extends ApplicationError {
    constructor(public message: string) {
        super(message);
    }
}

class UnknownError extends ApplicationError {
    constructor(public message: string) {
        super(message);
    }
}

async function tryOrThrow<T>(fn: (() => Promise<T>) | Promise<T>, error: ApplicationError): Promise<T> {
    try {
        if(typeof fn === "function") {
            return await fn();
        } else {
            return await fn;
        }
    } catch (e) {
        if(e instanceof ApplicationError) throw e
        // TODO: Move to local file, or keep on stderr?
        console.error(error.message, e);
        throw error;
    }
}

export { tryOrThrow, ApplicationError, NotFoundError, AlreadyExistsError, IOError, ValidationError, UnknownError }