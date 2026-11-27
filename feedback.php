<?php
/* =====================================================================================
   feedback.php - receives the footer "Feedback" form, saves it in uswag_db (table Feedback),
   then sends the visitor to feedback-thanks.html.

   SETTINGS: these are the Laragon defaults. If api.php uses another MySQL user / password,
   put the same values here (or set the environment variables USWAG_DB_USER / USWAG_DB_PASS).
   ===================================================================================== */
$DB = [
    'host' => getenv('USWAG_DB_HOST') ?: '127.0.0.1',
    'port' => (int)(getenv('USWAG_DB_PORT') ?: 3306),
    'name' => getenv('USWAG_DB_NAME') ?: 'uswag_db',
    'user' => getenv('USWAG_DB_USER') ?: 'root',
    'pass' => getenv('USWAG_DB_PASS') !== false ? getenv('USWAG_DB_PASS') : '',
];
const FEEDBACK_MAX_PER_HOUR = 5;       // per visitor (by hashed IP), so nobody can flood the table
const FEEDBACK_TYPES = ['Suggestion', 'Improvement', 'Problem', 'Compliment', 'Other'];

/* Same table as in uswag_db.sql. It is repeated here so the form still works on a database
   that was imported before this table existed (it is only created when it is missing). */
const FEEDBACK_TABLE_SQL = "CREATE TABLE IF NOT EXISTS Feedback (
    feedback_id             INT PRIMARY KEY AUTO_INCREMENT,
    sender_name             VARCHAR(100) NULL,
    sender_contact          VARCHAR(100) NULL,
    feedback_type           ENUM('Suggestion','Improvement','Problem','Compliment','Other') NOT NULL DEFAULT 'Suggestion',
    message_body            VARCHAR(1000) NOT NULL,
    page_url                VARCHAR(80)  NULL,
    status                  ENUM('New','Reviewed','Done') NOT NULL DEFAULT 'New',
    ip_hash                 CHAR(64) NULL,
    reviewed_by_account_id  INT NULL,
    reviewed_at             DATETIME NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedback_reviewer FOREIGN KEY (reviewed_by_account_id) REFERENCES Accounts(account_id) ON DELETE SET NULL,
    CONSTRAINT chk_feedback_len CHECK (CHAR_LENGTH(message_body) >= 10),
    INDEX idx_feedback_status (status, created_at),
    INDEX idx_feedback_ip (ip_hash, created_at)
) ENGINE=InnoDB";

header('Cache-Control: no-store');

/** Send the visitor to the thank-you page and stop. */
function go(string $status, string $code, string $page): void
{
    $q = ['status' => $status];
    if ($code !== '') { $q['code'] = $code; }
    $q['ref'] = $page;
    header('Location: feedback-thanks.html?' . http_build_query($q), true, 303);
    exit;
}

/** Trim, drop control characters, cut to a length. */
function clean(?string $s, int $max, bool $keepNewlines = false): string
{
    $s = (string)$s;
    $s = preg_replace($keepNewlines ? '/[^\P{C}\n]+/u' : '/\p{C}+/u', ' ', $s) ?? '';
    $s = trim($s);
    return mb_substr($s, 0, $max, 'UTF-8');
}

$page = (isset($_POST['page']) && preg_match('/^[A-Za-z0-9_\-]+\.html$/', (string)$_POST['page']))
    ? (string)$_POST['page'] : 'index.html';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    go('error', 'method', $page);
}

/* spam trap: bots fill this hidden field, people never see it. Pretend it worked. */
if (trim((string)($_POST['website'] ?? '')) !== '') {
    go('ok', '', $page);
}

$name    = clean($_POST['name'] ?? '', 100);
$contact = clean($_POST['contact'] ?? '', 100);
$type    = (string)($_POST['type'] ?? 'Suggestion');
$message = clean($_POST['message'] ?? '', 1000, true);

if (!in_array($type, FEEDBACK_TYPES, true)) { $type = 'Other'; }
if (mb_strlen($message, 'UTF-8') < 10)      { go('error', 'short', $page); }

$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ipHash = hash('sha256', $ip . '|uswag-feedback');

try {
    $pdo = new PDO(
        "mysql:host={$DB['host']};port={$DB['port']};dbname={$DB['name']};charset=utf8mb4",
        $DB['user'],
        $DB['pass'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $count = static function (PDO $pdo, string $ipHash): int {
        $st = $pdo->prepare('SELECT COUNT(*) FROM Feedback WHERE ip_hash = ? AND created_at > (NOW() - INTERVAL 1 HOUR)');
        $st->execute([$ipHash]);
        return (int)$st->fetchColumn();
    };

    try {
        $recent = $count($pdo, $ipHash);
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) !== 1146) { throw $e; }   // 1146 = table does not exist yet
        $pdo->exec(FEEDBACK_TABLE_SQL);
        $recent = 0;
    }

    if ($recent >= FEEDBACK_MAX_PER_HOUR) {
        go('error', 'rate', $page);
    }

    $st = $pdo->prepare(
        'INSERT INTO Feedback (sender_name, sender_contact, feedback_type, message_body, page_url, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $st->execute([
        $name !== '' ? $name : null,
        $contact !== '' ? $contact : null,
        $type,
        $message,
        $page,
        $ipHash,
    ]);
} catch (Throwable $e) {
    error_log('USWAG feedback.php: ' . $e->getMessage());
    go('error', 'server', $page);
}

go('ok', '', $page);
