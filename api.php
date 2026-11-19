<?php
header('Content-Type: application/json; charset=utf-8');

// เก็บไฟล์ข้อมูลไว้นอกโฟลเดอร์สาธารณะของเว็บ (ป้องกันคนเปิดดูผ่าน Public URL โดยตรง)
$dataDir = dirname(__DIR__) . '/data';
$dataFile = $dataDir . '/portfolios_data.json';

if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$method = $_SERVER['REQUEST_METHOD'];

// 1. อ่านข้อมูลทั้งหมดจาก Server (GET)
if ($method === 'GET') {
    $content = file_get_contents($dataFile);
    $data = json_decode($content, true);
    echo json_encode(is_array($data) ? $data : [], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. ตรวจสอบและบันทึกข้อมูลลง Server (POST)
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $portfolios = json_decode($rawInput, true);

    if (!is_array($portfolios)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'รูปแบบข้อมูล JSON ไม่ถูกต้อง']);
        exit;
    }

    foreach ($portfolios as $p) {
        if (empty($p['id']) || empty($p['name']) || !isset($p['items']) || !is_array($p['items'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'ข้อมูล Portfolio ไม่ครบถ้วน']);
            exit;
        }

        $seenIds = [];
        foreach ($p['items'] as $item) {
            if (empty($item['id']) || in_array($item['id'], $seenIds)) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'พบ ID ซ้ำหรือไม่มี ID ในรายการ: ' . ($item['title'] ?? '')]);
                exit;
            }
            $seenIds[] = $item['id'];

            if (empty($item['title']) || empty($item['type']) || empty($item['date']) || empty($item['role']) || empty($item['description'])) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'ข้อมูลพื้นฐานของ Item ไม่ครบถ้วน']);
                exit;
            }

            $ref = $item['reflection'] ?? [];
            if (empty($ref['whatIDid']) || empty($ref['whatILearned']) || empty($ref['challenge']) || empty($ref['nextStep'])) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'ข้อมูล Reflection ต้องกรอกให้ครบทั้ง 4 ช่อง']);
                exit;
            }

            if (empty($item['evidence']) || !is_array($item['evidence'])) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'ต้องมีลิงก์ Evidence อย่างน้อย 1 รายการ']);
                exit;
            }
            foreach ($item['evidence'] as $url) {
                if (!filter_var($url, FILTER_VALIDATE_URL)) {
                    http_response_code(400);
                    echo json_encode(['status' => 'error', 'message' => 'URL หลักฐานไม่ถูกต้อง: ' . $url]);
                    exit;
                }
            }
        }
    }

    if (file_put_contents($dataFile, json_encode($portfolios, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false) {
        echo json_encode(['status' => 'success', 'message' => 'บันทึกข้อมูลลง Server สำเร็จ']);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Server ไม่สามารถเขียนไฟล์ได้ (ตรวจสอบ Permission โฟลเดอร์ data)']);
    }
    exit;
}
?>