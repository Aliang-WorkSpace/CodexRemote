import Testing
@testable import ControlPlaneMobileCore

@Test func transportInfoPrefersPhoneAccessURLForDisplay() {
    let transport = TransportInfo(
        type: "http",
        baseURL: "http://127.0.0.1:8793",
        localBaseURL: "http://127.0.0.1:8793",
        phoneAccessURL: "http://192.168.1.8:8793",
        isLocalOnly: false,
        hint: "same wifi"
    )

    #expect(transport.preferredDisplayURL == "http://192.168.1.8:8793")
}

@Test func submittedCommandMapsStableChineseStatusLabels() {
    #expect(SubmittedCommand(id: "1", status: "queued", acknowledgementMessage: nil).statusDisplayName == "排队中")
    #expect(SubmittedCommand(id: "1", status: "running", acknowledgementMessage: nil).statusDisplayName == "执行中")
    #expect(SubmittedCommand(id: "1", status: "completed", acknowledgementMessage: nil).statusDisplayName == "已完成")
    #expect(SubmittedCommand(id: "1", status: "failed", acknowledgementMessage: nil).statusDisplayName == "失败")
    #expect(SubmittedCommand(id: "1", status: "mystery", acknowledgementMessage: nil).statusDisplayName == "mystery")
}

@Test func submittedCommandUsesAcknowledgementMessageAsFeedbackSummary() {
    let command = SubmittedCommand(
        id: "1",
        status: "completed",
        acknowledgementMessage: "远程续聊成功。"
    )

    #expect(command.feedbackSummary == "远程续聊成功。")
}
