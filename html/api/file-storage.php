<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configuration
$UPLOAD_DIR = '/etc/peer-server/storage/files/';
$ARCHIVE_DIR = '/etc/peer-server/storage/archive/';
$MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1000MB (1GB)

// Ensure directories exist
if (!file_exists($UPLOAD_DIR)) {
    mkdir($UPLOAD_DIR, 0755, true);
}
if (!file_exists($ARCHIVE_DIR)) {
    mkdir($ARCHIVE_DIR, 0755, true);
}

function validateUserId($userId) {
    return preg_match('/^[A-Za-z0-9]{24}$/', $userId);
}

function sanitizeFileName($fileName) {
    return preg_replace('/[^A-Za-z0-9._-]/', '_', $fileName);
}

function generateFileId() {
    return bin2hex(random_bytes(16));
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'upload':
        handleUpload();
        break;
    case 'list':
        handleList();
        break;
    case 'download':
        handleDownload();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

function handleUpload() {
    global $UPLOAD_DIR, $MAX_FILE_SIZE;
    
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }

    $recipientId = $_POST['recipient_id'] ?? '';
    $senderId = $_POST['sender_id'] ?? '';
    
    if (!validateUserId($recipientId) || !validateUserId($senderId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid user ID format']);
        return;
    }

    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No file uploaded']);
        return;
    }

    $file = $_FILES['file'];
    
    if ($file['size'] > $MAX_FILE_SIZE) {
        http_response_code(400);
        echo json_encode(['error' => 'File too large']);
        return;
    }

    $originalName = sanitizeFileName($file['name']);
    $fileId = generateFileId();
    $timestamp = time();
    
    // Create recipient directory
    $recipientDir = $UPLOAD_DIR . $recipientId . '/';
    if (!file_exists($recipientDir)) {
        mkdir($recipientDir, 0755, true);
    }

    // Save file with metadata
    $fileData = [
        'file_id' => $fileId,
        'original_name' => $originalName,
        'sender_id' => $senderId,
        'recipient_id' => $recipientId,
        'timestamp' => $timestamp,
        'size' => $file['size']
    ];

    $metadataFile = $recipientDir . $fileId . '.json';
    $encryptedFile = $recipientDir . $fileId . '.dat';

    if (move_uploaded_file($file['tmp_name'], $encryptedFile)) {
        file_put_contents($metadataFile, json_encode($fileData));
        echo json_encode(['success' => true, 'file_id' => $fileId]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save file']);
    }
}

function handleList() {
    global $UPLOAD_DIR;
    
    $userId = $_GET['user_id'] ?? '';
    
    if (!validateUserId($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid user ID format']);
        return;
    }

    $userDir = $UPLOAD_DIR . $userId . '/';
    $files = [];

    if (file_exists($userDir)) {
        $metadataFiles = glob($userDir . '*.json');
        
        foreach ($metadataFiles as $metadataFile) {
            $metadata = json_decode(file_get_contents($metadataFile), true);
            if ($metadata) {
                $files[] = $metadata;
            }
        }
    }

    // Sort by timestamp (newest first)
    usort($files, function($a, $b) {
        return $b['timestamp'] - $a['timestamp'];
    });

    echo json_encode(['files' => $files]);
}

function handleDownload() {
    global $UPLOAD_DIR, $ARCHIVE_DIR;
    
    $userId = $_GET['user_id'] ?? '';
    $fileId = $_GET['file_id'] ?? '';
    
    if (!validateUserId($userId) || !preg_match('/^[a-f0-9]{32}$/', $fileId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid parameters']);
        return;
    }

    $userDir = $UPLOAD_DIR . $userId . '/';
    $metadataFile = $userDir . $fileId . '.json';
    $encryptedFile = $userDir . $fileId . '.dat';

    if (!file_exists($metadataFile) || !file_exists($encryptedFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        return;
    }

    $metadata = json_decode(file_get_contents($metadataFile), true);
    
    // Prepare archive directory
    $archiveDir = $ARCHIVE_DIR . $userId . '/';
    if (!file_exists($archiveDir)) {
        mkdir($archiveDir, 0755, true);
    }

    // Send file for download
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $metadata['original_name'] . '"');
    header('Content-Length: ' . filesize($encryptedFile));
    
    readfile($encryptedFile);

    // Move to archive
    rename($metadataFile, $archiveDir . $fileId . '.json');
    rename($encryptedFile, $archiveDir . $fileId . '.dat');
}
?>
