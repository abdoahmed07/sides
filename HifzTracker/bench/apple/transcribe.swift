// Transcribes audio files with Apple's speech recognition: the engine behind iPhone dictation, which
// the app's phone mode uses through Safari. One JSON line per file.
//
//   transcribe <locale> [--on-device] [file…]     (no files: says whether it's available)
import Foundation
import Speech

setvbuf(stdout, nil, _IOLBF, 0)
var args = Array(CommandLine.arguments.dropFirst())
let onDevice = args.contains("--on-device")
args.removeAll { $0 == "--on-device" }
guard !args.isEmpty else {
  FileHandle.standardError.write("usage: transcribe <locale> [--on-device] [file…]\n".data(using: .utf8)!)
  exit(2)
}
let locale = Locale(identifier: args.removeFirst())

func emit(_ object: [String: Any]) {
  let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
  print(String(data: data, encoding: .utf8)!)
}

// Permission (asked once; System Settings › Privacy & Security › Speech Recognition).
var status = SFSpeechRecognizer.authorizationStatus()
if status == .notDetermined {
  let asked = DispatchSemaphore(value: 0)
  SFSpeechRecognizer.requestAuthorization { s in
    status = s
    asked.signal()
  }
  asked.wait()
}
guard status == .authorized else {
  emit(["error": "not authorized", "status": status.rawValue])
  exit(3)
}
guard let recognizer = SFSpeechRecognizer(locale: locale) else {
  emit(["error": "no recognizer for \(locale.identifier)"])
  exit(4)
}
recognizer.queue = OperationQueue()
if args.isEmpty {
  emit(["available": recognizer.isAvailable, "onDevice": recognizer.supportsOnDeviceRecognition, "locale": locale.identifier])
  exit(0)
}

/** One file's outcome, filled in by the recognition callback (on its own queue). */
final class Outcome: @unchecked Sendable {
  var fields: [String: Any] = [:]
  var done = false
  let lock = NSLock()
  let finished = DispatchSemaphore(value: 0)
  func finish(_ update: [String: Any]) {
    lock.lock()
    defer { lock.unlock() }
    if done { return }
    done = true
    fields.merge(update) { _, new in new }
    finished.signal()
  }
}

for path in args {
  let url = URL(fileURLWithPath: path)
  let request = SFSpeechURLRecognitionRequest(url: url)
  request.shouldReportPartialResults = false
  request.requiresOnDeviceRecognition = onDevice
  request.addsPunctuation = false
  let outcome = Outcome()
  let started = Date()
  let task = recognizer.recognitionTask(with: request) { result, error in
    if let result, result.isFinal {
      let words = result.bestTranscription.segments.map { ["w": $0.substring, "t": ($0.timestamp * 100).rounded() / 100, "c": ($0.confidence * 100).rounded() / 100] }
      outcome.finish(["text": result.bestTranscription.formattedString, "words": words])
    } else if let error {
      outcome.finish(["error": error.localizedDescription])
    }
  }
  if outcome.finished.wait(timeout: .now() + 180) == .timedOut {
    task.cancel()
    outcome.finish(["error": "timeout"])
  }
  outcome.lock.lock()
  var line = outcome.fields
  outcome.lock.unlock()
  line["file"] = url.lastPathComponent
  line["seconds"] = (Date().timeIntervalSince(started) * 10).rounded() / 10
  emit(line)
}
