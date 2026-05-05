
pub struct DiffLine {
    pub kind: char,
    pub content: String,
}

pub struct DiffHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<DiffLine>,
}

pub fn parse_unified_diff(text: &str) -> Result<Vec<DiffHunk>, String> {
    let lines: Vec<&str> = text.lines().collect();
    let mut hunks = Vec::new();
    let mut i = skip_diff_headers(&lines);

    while i < lines.len() {
        if !lines[i].starts_with("@@") {
            i += 1;
            continue;
        }

        let (old_start, old_count, new_start, new_count) = parse_hunk_header(lines[i])?;
        i += 1;

        let counts = HunkCounts { old_count, new_count };
        let (hunk_lines, new_i) = collect_hunk_lines(&lines, i, &counts);
        i = new_i;

        hunks.push(DiffHunk { old_start, old_count, new_start, new_count, lines: hunk_lines });
    }

    Ok(hunks)
}

pub fn find_lines(haystack: &[String], needle: &[&str], hint: usize) -> Option<usize> {
    if needle.is_empty() {
        return Some(hint.min(haystack.len()));
    }
    let tolerance = 3;
    let n = needle.len();
    let search_start = hint.saturating_sub(tolerance);
    let search_end = (hint + tolerance + n).min(haystack.len() + 1);

    for pos in search_start..=search_end.saturating_sub(n) {
        if pos + n <= haystack.len() && slice_matches(&haystack[pos..pos + n], needle) {
            return Some(pos);
        }
    }

    for pos in 0..=haystack.len().saturating_sub(n) {
        if slice_matches(&haystack[pos..pos + n], needle) {
            return Some(pos);
        }
    }

    None
}

fn parse_hunk_header(line: &str) -> Result<(usize, usize, usize, usize), String> {
    let first_at = line.find("@@")
        .ok_or_else(|| "Hunk header malformado: falta @@".to_string())?;
    let second_at = line[first_at + 2..].find("@@")
        .map(|i| i + first_at + 2)
        .ok_or_else(|| "Hunk header malformado: falta @@ de cierre".to_string())?;
    let inner = line[first_at + 2..second_at].trim();

    let mut parts = inner.splitn(2, ' ');
    let old_part = parts.next()
        .ok_or_else(|| "Hunk header malformado".to_string())?
        .trim_start_matches('-');
    let new_part = parts.next()
        .ok_or_else(|| "Hunk header malformado".to_string())?
        .trim_start_matches('+');

    let old_start = old_part.split(',').next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let old_count = old_part.split(',').nth(1).and_then(|s| s.parse().ok()).unwrap_or(1);
    let new_start = new_part.split(',').next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let new_count = new_part.split(',').nth(1).and_then(|s| s.parse().ok()).unwrap_or(1);

    Ok((old_start, old_count, new_start, new_count))
}

fn skip_diff_headers(lines: &[&str]) -> usize {
    let mut i = 0;
    while i < lines.len() && !lines[i].starts_with("@@") {
        i += 1;
    }
    i
}

struct HunkCounts {
    old_count: usize,
    new_count: usize,
}

fn collect_hunk_lines(
    lines: &[&str],
    start: usize,
    counts: &HunkCounts,
) -> (Vec<DiffLine>, usize) {
    let mut hunk_lines = Vec::new();
    let mut old_read = 0usize;
    let mut new_read = 0usize;
    let mut i = start;

    while i < lines.len() && !lines[i].starts_with("@@") {
        let line = lines[i];

        if line.starts_with('\\') {
            i += 1;
            continue;
        }

        if line.is_empty() {
            if old_read < counts.old_count || new_read < counts.new_count {
                hunk_lines.push(DiffLine { kind: ' ', content: String::new() });
                old_read += 1;
                new_read += 1;
                i += 1;
                continue;
            }
            break;
        }

        let first = line.chars().next().unwrap();
        if first == ' ' || first == '+' || first == '-' {
            hunk_lines.push(DiffLine { kind: first, content: line[1..].to_string() });
            if first == ' ' || first == '-' { old_read += 1; }
            if first == ' ' || first == '+' { new_read += 1; }
            i += 1;
        } else {
            break;
        }
    }

    (hunk_lines, i)
}

fn slice_matches(haystack_slice: &[String], needle: &[&str]) -> bool {
    haystack_slice.iter().zip(needle.iter()).all(|(h, ne)| h.as_str() == *ne)
}
