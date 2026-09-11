use mdtheme::{Frame, render};
use serde::Deserialize;
#[derive(Deserialize)]
struct Case {
    name: String,
    source: String,
    themes: Vec<TestFrame>,
    expected: String,
}
#[derive(Deserialize)]
struct TestFrame {
    opening: String,
    closing: String,
}
#[test]
fn matches_typescript_rendering_corpus() {
    // Captured from the TypeScript renderer at 87efbe3 before removing it.
    let cases: Vec<Case> = serde_json::from_str(include_str!("fixtures/rendering.json")).unwrap();
    assert_eq!(cases.len(), 14);
    for case in cases {
        let frames: Vec<_> = case
            .themes
            .into_iter()
            .map(|f| Frame {
                opening: f.opening,
                closing: f.closing,
            })
            .collect();
        assert_eq!(
            render(&case.source, &frames, "README.md.src").unwrap(),
            case.expected,
            "{}",
            case.name
        );
    }
}
