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
                ..Frame::default()
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

#[test]
fn badge_slot_composes_nested_themes_without_moving_content() {
    let frames = [
        Frame {
            badges_prepend: "outer-first\n".into(),
            badges_append: "outer-last\n".into(),
            ..Frame::default()
        },
        Frame {
            badges_prepend: "inner-first".into(),
            badges_append: "inner-last".into(),
            ..Frame::default()
        },
    ];
    let source = "# Title\r\n\r\n<!-- mdtheme:badges:start -->\r\n[![Own](image)](link)\r\n<!-- mdtheme:badges:end -->\r\n\r\n*   Body  \r\n";
    let rendered = render(source, &frames, "README.md.src").unwrap();
    assert!(rendered.ends_with("# Title\r\n\r\nouter-first inner-first [![Own](image)](link) inner-last outer-last\r\n\r\n*   Body  \r\n"));
    assert!(!rendered.contains("mdtheme:badges"));
}

#[test]
fn badges_without_slot_use_one_row_before_source() {
    let frame = Frame {
        opening: "Header".into(),
        badges_prepend: "First".into(),
        badges_append: "Last".into(),
        ..Frame::default()
    };
    assert!(
        render("Body", &[frame], "README.md.src")
            .unwrap()
            .ends_with("Header\n\nFirst Last\n\nBody")
    );
}

#[test]
fn malformed_or_duplicate_badge_slots_fail() {
    for source in [
        "<!-- mdtheme:badges:start -->",
        "<!-- mdtheme:badges:end -->",
        "<!-- mdtheme:badges:end --><!-- mdtheme:badges:start -->",
        "<!-- mdtheme:badges:start --><!-- mdtheme:badges:start --><!-- mdtheme:badges:end -->",
        "<!-- mdtheme:badges:start --><!-- mdtheme:badges:end --><!-- mdtheme:badges:end -->",
    ] {
        assert!(render(source, &[], "README.md.src").is_err());
    }
}
