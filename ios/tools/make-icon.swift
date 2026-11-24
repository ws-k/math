// 앱 아이콘 시안 생성기.
//   swift ios/tools/make-icon.swift <도안> <out.png>
//   swift ios/tools/make-icon.swift            (도안 목록 출력)
//
// CoreGraphics·ImageIO 만 쓴다 — 바깥 도구(이미지 편집기·npm 패키지) 없이 맥 기본만으로
// 언제든 같은 그림을 다시 뽑을 수 있게 하려는 것. 그래서 앱 타깃(Math/) 밖에 둔다
// (docs/plan-ios.md 결정 2: 안에 두면 앱에 섞여 컴파일된다).
//
// 좌표는 CoreGraphics 기본(왼쪽 아래가 원점, y 가 위로)을 그대로 쓴다. 블록을 "바닥부터
// 쌓는" 그림이라 y 가 위로 자라는 편이 계산이 덜 헷갈린다.

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let S = CGFloat(size)

// 앱 강조색(src/app/app.css --primary). 아이콘도 같은 파랑이어야 앱을 열었을 때 이어져 보인다.
let accent = hex(0x2559e6)
// 바탕 위아래로 아주 약하게만 명암을 준다. 완전 평면이면 홈 화면에서 다른 아이콘 옆에
// 납작해 보이고, 진하게 주면 2010년대 광택 아이콘처럼 낡아 보인다.
let accentTop = hex(0x2e64f0)
let accentBottom = hex(0x1f4fd8)
let white = hex(0xffffff)
// 앱의 --coin. 손글씨(펜)로 '맞았다'를 표시하는 색이라 체크 표시에 쓴다.
let coin = hex(0xffc53d)

func hex(_ v: UInt32) -> CGColor {
    CGColor(
        srgbRed: CGFloat((v >> 16) & 0xff) / 255,
        green: CGFloat((v >> 8) & 0xff) / 255,
        blue: CGFloat(v & 0xff) / 255,
        alpha: 1)
}

func fillBackground(_ c: CGContext) {
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let g = CGGradient(colorsSpace: space, colors: [accentBottom, accentTop] as CFArray, locations: [0, 1])!
    c.drawLinearGradient(g, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: S), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}

// 블록 모서리를 살짝 둥글게. 각진 정사각형은 픽셀 게임처럼 보여 유치해지고,
// 너무 둥글면 알약처럼 보여 '쌓은 블록'으로 안 읽힌다. 한 변의 14% 근처가 그 사이.
func block(_ c: CGContext, _ r: CGRect, _ color: CGColor, radiusRatio: CGFloat = 0.14) {
    let rad = min(r.width, r.height) * radiusRatio
    c.addPath(CGPath(roundedRect: r, cornerWidth: rad, cornerHeight: rad, transform: nil))
    c.setFillColor(color)
    c.fillPath()
}

// 손으로 그은 선처럼 끝과 꺾임을 둥글게 한다(펜 획의 느낌).
func stroke(_ c: CGContext, _ pts: [CGPoint], width: CGFloat, color: CGColor) {
    c.setLineCap(.round)
    c.setLineJoin(.round)
    c.setLineWidth(width)
    c.setStrokeColor(color)
    c.addLines(between: pts)
    c.strokePath()
}

// 계단: 열 col 에 col+1 개를 쌓는다(1·2·3단).
// 삼각형 모양이라 무게중심이 오른쪽 아래로 쏠린다. 경계 상자 대신 무게중심을 화면
// 가운데로 맞추면 반대로 너무 왼쪽 위로 가서, 그 중간쯤(nudge)만 당긴다.
func stairs(_ c: CGContext, cols: Int, unit: CGFloat, gap: CGFloat, nudge: CGFloat, color: (Int, Int) -> CGColor) {
    let total = CGFloat(cols) * unit + CGFloat(cols - 1) * gap
    let x0 = (S - total) / 2 - nudge
    let y0 = (S - total) / 2 + nudge
    for col in 0..<cols {
        for row in 0...col {
            let r = CGRect(x: x0 + CGFloat(col) * (unit + gap), y: y0 + CGFloat(row) * (unit + gap), width: unit, height: unit)
            block(c, r, color(col, row))
        }
    }
}

// (a) 계단 — 계획서의 제안 도안 그대로. 흰 블록 3단.
func drawStairs(_ c: CGContext) {
    fillBackground(c)
    stairs(c, cols: 3, unit: 196, gap: 26, nudge: 34) { _, _ in white }
}

// (b) 두 단은 블록, 마지막 단은 펜으로 그은 체크 — "쌓다가 손으로 확인했다".
// 블록이 왼쪽 아래, 체크가 오른쪽 위를 맡아 대각선으로 균형을 잡는다.
func drawStairsCheck(_ c: CGContext) {
    fillBackground(c)
    let u: CGFloat = 214
    let g: CGFloat = 26
    let x0: CGFloat = 176
    let y0: CGFloat = 168
    block(c, CGRect(x: x0, y: y0, width: u, height: u), white)
    block(c, CGRect(x: x0 + u + g, y: y0, width: u, height: u), white)
    block(c, CGRect(x: x0 + u + g, y: y0 + u + g, width: u, height: u), white)
    // 체크 획: 짧게 내려갔다 길게 올라간다. 굵기는 블록 한 변의 약 1/3 —
    // 60px 에서도 선이 4px 남아 안 사라진다. 블록에 닿으면 획이 블록 모서리와 엉켜
    // 지저분해 보여서, 가장 가까운 곳도 획 굵기의 절반쯤 떨어뜨린다.
    stroke(c, [
        CGPoint(x: 636, y: 700),
        CGPoint(x: 706, y: 630),
        CGPoint(x: 846, y: 826),
    ], width: 76, color: coin)
}

// (c) 루트(√) 기호 아래에 계단 블록 — "√ 안을 다시 쌓는다".
// 기호는 획(선), 안쪽은 면(블록)이라 둘이 섞이지 않고 따로 읽힌다.
func drawRoot(_ c: CGContext) {
    fillBackground(c)
    let w: CGFloat = 60
    // 왼쪽 갈고리 → 아래 골짜기 → 위로 길게 → 가로 지붕.
    stroke(c, [
        CGPoint(x: 176, y: 476),
        CGPoint(x: 240, y: 508),
        CGPoint(x: 346, y: 214),
        CGPoint(x: 480, y: 792),
        CGPoint(x: 856, y: 792),
    ], width: w, color: white)
    // 지붕 아래 계단 블록. 바닥을 √ 골짜기 높이에 맞춰 '기호 안에 담긴' 것처럼 보이게 하고,
    // 지붕과는 틈을 넉넉히 남긴다 — 붙으면 60px 에서 기호와 블록이 한 덩어리로 뭉친다.
    let u: CGFloat = 116
    let g: CGFloat = 16
    let x0: CGFloat = 476
    let y0: CGFloat = 184
    for col in 0..<3 {
        for row in 0...col {
            block(c, CGRect(x: x0 + CGFloat(col) * (u + g), y: y0 + CGFloat(row) * (u + g), width: u, height: u), white)
        }
    }
}

let designs: [String: (String, (CGContext) -> Void)] = [
    "stairs": ("흰 블록 3단 계단", drawStairs),
    "stairs-check": ("블록 2단 + 펜 체크", drawStairsCheck),
    "root": ("√ 아래 계단 블록", drawRoot),
]

func render(_ draw: (CGContext) -> Void, to path: String) throws {
    // noneSkipLast = 투명 채널 없이 RGB 만. App Store 는 투명이 섞인 아이콘을 거절하므로
    // 그리는 단계부터 투명을 만들 수 없는 판을 쓴다(나중에 지우는 것보다 확실하다).
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                              space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
        throw NSError(domain: "make-icon", code: 1, userInfo: [NSLocalizedDescriptionKey: "그림판을 못 만들었다"])
    }
    ctx.setShouldAntialias(true)
    draw(ctx)
    guard let img = ctx.makeImage() else {
        throw NSError(domain: "make-icon", code: 2, userInfo: [NSLocalizedDescriptionKey: "이미지를 못 뽑았다"])
    }
    let url = URL(fileURLWithPath: path)
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "make-icon", code: 3, userInfo: [NSLocalizedDescriptionKey: "파일을 못 열었다: \(path)"])
    }
    CGImageDestinationAddImage(dest, img, nil)
    if !CGImageDestinationFinalize(dest) {
        throw NSError(domain: "make-icon", code: 4, userInfo: [NSLocalizedDescriptionKey: "PNG 저장 실패: \(path)"])
    }
}

let args = CommandLine.arguments.dropFirst()
guard args.count == 2, let (_, draw) = designs[args.first!] else {
    let list = designs.keys.sorted().map { "  \($0)  — \(designs[$0]!.0)" }.joined(separator: "\n")
    FileHandle.standardError.write("사용법: swift ios/tools/make-icon.swift <도안> <out.png>\n도안:\n\(list)\n".data(using: .utf8)!)
    exit(args.isEmpty ? 0 : 1)
}
do {
    try render(draw, to: args.last!)
} catch {
    FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
    exit(1)
}
