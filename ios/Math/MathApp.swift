import SwiftUI

// SwiftUI @main App + WindowGroup 은 그 자체가 UIScene 방식이라 iOS 27 의 UIScene 필수 요건을 채운다.
@main
struct MathApp: App {
    var body: some Scene {
        WindowGroup {
            Color("LaunchBackground")
                .ignoresSafeArea()
        }
    }
}
