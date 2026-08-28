import Foundation

enum CallbackAwaiterError: Error, Equatable, LocalizedError {
    case timedOut(operation: String)

    var errorDescription: String? {
        switch self {
        case let .timedOut(operation):
            return "\(operation) timed out"
        }
    }
}

enum CallbackAwaiter {
    static func value<Value>(
        operation: String,
        timeoutNanoseconds: UInt64,
        start: (@escaping (Result<Value, Error>) -> Void) -> Void
    ) async throws -> Value {
        let state = CallbackAwaiterState<Value>()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                state.install(continuation)
                start { result in
                    state.resolve(result)
                }
                let timeoutTask = Task {
                    try? await Task.sleep(nanoseconds: timeoutNanoseconds)
                    guard !Task.isCancelled else { return }
                    state.resolve(.failure(CallbackAwaiterError.timedOut(operation: operation)))
                }
                state.installTimeoutTask(timeoutTask)
            }
        } onCancel: {
            state.resolve(.failure(CancellationError()))
        }
    }
}

private final class CallbackAwaiterState<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Value, Error>?
    private var pendingResult: Result<Value, Error>?
    private var timeoutTask: Task<Void, Never>?
    private var isResolved = false

    func install(_ continuation: CheckedContinuation<Value, Error>) {
        lock.lock()
        if let pendingResult {
            self.pendingResult = nil
            lock.unlock()
            continuation.resume(with: pendingResult)
        } else {
            self.continuation = continuation
            lock.unlock()
        }
    }

    func installTimeoutTask(_ task: Task<Void, Never>) {
        lock.lock()
        if isResolved {
            lock.unlock()
            task.cancel()
        } else {
            timeoutTask = task
            lock.unlock()
        }
    }

    func resolve(_ result: Result<Value, Error>) {
        lock.lock()
        guard !isResolved else {
            lock.unlock()
            return
        }
        isResolved = true
        if let continuation {
            self.continuation = nil
            let timeoutTask = self.timeoutTask
            self.timeoutTask = nil
            lock.unlock()
            timeoutTask?.cancel()
            continuation.resume(with: result)
        } else {
            pendingResult = result
            lock.unlock()
        }
    }
}
