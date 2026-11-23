// Apple Health for the page (Matt, Nov 22 2026; APP_PORTS/shared/src/health.ts): READ ONLY — recorded workouts and
// the active energy (calories) each one burned. Nothing is written to Health, and nothing leaves the phone.
//
//   { op: "status" }            → "ok" | "unavailable" (no Health on this device, an iPad) | "no-build" (built without it)
//   { op: "authorize" }         → true when Apple Health's own sheet went through (it never says what was allowed)
//   { op: "workouts", since }   → [{ id, what, startMs, endMs, calories }] for workouts that started at or after `since` (ms)
import Foundation
import WebKit
#if !CC_NO_HEALTH
import HealthKit
#endif

final class HealthBridge: NSObject, WKScriptMessageHandlerWithReply {
    #if !CC_NO_HEALTH
    private let store = HKHealthStore()
    private let read: Set<HKObjectType> = [HKObjectType.workoutType(), HKQuantityType(.activeEnergyBurned)]
    #endif

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        // only the app's own page may ask
        guard message.frameInfo.securityOrigin.protocol == LocalFiles.scheme,
              let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "That request was not understood.")
            return
        }
        #if CC_NO_HEALTH
        if op == "status" { replyHandler("no-build", nil) } else { replyHandler(nil, "This copy of the app was built without Apple Health.") }
        #else
        switch op {
        case "status":
            replyHandler(HKHealthStore.isHealthDataAvailable() ? "ok" : "unavailable", nil)
        case "authorize":
            guard HKHealthStore.isHealthDataAvailable() else { replyHandler(false, nil); return }
            store.requestAuthorization(toShare: [], read: read) { ok, error in
                DispatchQueue.main.async {
                    if let error { replyHandler(nil, "Apple Health said: \(error.localizedDescription)") } else { replyHandler(ok, nil) }
                }
            }
        case "workouts":
            let since = Date(timeIntervalSince1970: ((body["since"] as? Double) ?? 0) / 1000)
            let when = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
            let order = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            let query = HKSampleQuery(sampleType: .workoutType(), predicate: when, limit: HKObjectQueryNoLimit, sortDescriptors: order) { _, samples, error in
                let list: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { w in
                    let kcal = w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
                    return ["id": w.uuid.uuidString, "what": Self.name(of: w),
                            "startMs": w.startDate.timeIntervalSince1970 * 1000, "endMs": w.endDate.timeIntervalSince1970 * 1000,
                            "calories": kcal.map { $0 as Any } ?? NSNull()]
                }
                DispatchQueue.main.async {
                    // no permission reads as no workouts (Health never says), so only a real failure is an error
                    if let error, (error as? HKError)?.code != .errorAuthorizationNotDetermined { replyHandler(nil, "Apple Health said: \(error.localizedDescription)") }
                    else { replyHandler(list, nil) }
                }
            }
            store.execute(query)
        default:
            replyHandler(nil, "That request was not understood.")
        }
        #endif
    }

    #if !CC_NO_HEALTH
    /// Health's kind of workout, as Craving Crusher's quick picks say it
    private static func name(of w: HKWorkout) -> String {
        switch w.workoutActivityType {
        case .walking: return "Walk"
        case .running: return "Run"
        case .cycling, .handCycling: return "Bike"
        case .swimming, .waterFitness: return "Swim"
        case .yoga, .mindAndBody: return "Yoga"
        case .hiking: return "Hike"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "Strength training"
        case .socialDance, .cardioDance: return "Dance"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .highIntensityIntervalTraining: return "HIIT"
        case .pilates: return "Pilates"
        case .tennis: return "Tennis"
        case .basketball: return "Basketball"
        case .soccer: return "Soccer"
        case .golf: return "Golf"
        case .stairClimbing, .stairs, .stepTraining: return "Stairs"
        case .crossTraining: return "Cross training"
        case .mixedCardio: return "Cardio"
        case .coreTraining: return "Core training"
        case .flexibility, .cooldown: return "Stretching"
        default: return "Workout"
        }
    }
    #endif
}
