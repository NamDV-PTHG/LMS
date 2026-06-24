# LLM_RECOMMENDATION.md — Chọn LLM offline cho RTX 2080 Ti

## Thông số GPU

| Spec | RTX 2080 Ti |
|------|-------------|
| VRAM | 11 GB GDDR6 |
| CUDA Cores | 4352 |
| Memory Bandwidth | 616 GB/s |
| Architecture | Turing (SM 7.5) |

**Ràng buộc cứng:** Model phải fit trong 11GB VRAM. Với quantization Q4_K_M, 1B params ≈ 0.7GB VRAM.
→ Giới hạn thực tế: ~13B params với Q4, hoặc ~7B params với Q8.

---

## So sánh các model phù hợp

### Nhóm 1 — Recommended cho task sinh câu hỏi + script tiếng Việt

#### 🥇 Qwen2.5:14b-Q4_K_M (KHUYẾN NGHỊ SỐ 1)
```
VRAM cần:    ~9.5 GB (Q4_K_M) ✅
Tốc độ:      ~15-20 tokens/s trên 2080 Ti
Tiếng Việt:  Xuất sắc — được train trên lượng lớn dữ liệu tiếng Việt
Reasoning:   Tốt cho sinh câu hỏi có giải thích
JSON output: Rất tốt, ít hallucinate format
Context:     128K tokens — đủ xử lý tài liệu dài
```

**Lý do chọn:** Qwen2.5 14B có khả năng tiếng Việt vượt trội so với Llama3 cùng kích thước, 
JSON structured output ổn định, phù hợp nhất cho task sinh câu hỏi từ tài liệu nội bộ.

```bash
ollama pull qwen2.5:14b
```

#### 🥈 Qwen2.5:7b-Q8_0
```
VRAM cần:    ~8.5 GB (Q8_0) ✅
Tốc độ:      ~30-35 tokens/s — nhanh gần gấp đôi
Tiếng Việt:  Tốt (kém 14B một chút)
JSON output: Tốt
Context:     128K tokens
```

**Khi nào chọn:** Nếu cần response nhanh hơn (wizard interactive), hoặc chạy nhiều request 
song song. Chất lượng câu hỏi sinh ra hơi đơn giản hơn 14B.

```bash
ollama pull qwen2.5:7b
```

#### 🥉 Llama3.1:8b-Q8_0
```
VRAM cần:    ~9 GB (Q8_0) ✅
Tốc độ:      ~25-30 tokens/s
Tiếng Việt:  Khá (kém Qwen2.5 về tiếng Việt)
JSON output: Tốt với function calling
Context:     128K tokens
```

**Khi nào chọn:** Nếu cần tích hợp tool/function calling chuẩn OpenAI format. Tiếng Việt 
kém hơn Qwen2.5 đáng kể.

---

### Nhóm 2 — KHÔNG phù hợp cho 2080 Ti

| Model | VRAM cần | Lý do loại |
|-------|----------|-----------|
| Llama3.1:70b | ~45 GB | Vượt VRAM 4x |
| Qwen2.5:32b | ~22 GB | Vượt VRAM 2x |
| Mixtral 8x7b | ~28 GB | Vượt VRAM |
| DeepSeek-R1:14b | ~9.5 GB | ✅ fit nhưng chậm, ít tiếng Việt |

---

## Cấu hình đề xuất theo use case

### Use case 1: Sinh câu hỏi từ tài liệu (chính)
```yaml
model: qwen2.5:14b
quantization: Q4_K_M
temperature: 0.3    # thấp để output ổn định, ít sáng tạo tùy tiện
max_tokens: 4096
```

### Use case 2: Course Wizard (tương tác)
```yaml
model: qwen2.5:7b   # nhanh hơn cho trải nghiệm chat
quantization: Q8_0
temperature: 0.5    # cao hơn để gợi ý đa dạng hơn
max_tokens: 2048
```

---

## Cài đặt Ollama server

### Cài Ollama trên Linux (Ubuntu 22.04)
```bash
curl -fsSL https://ollama.com/install.sh | sh

# Cấu hình cho phép access từ network (không chỉ localhost)
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf << EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=30m"
Environment="OLLAMA_NUM_PARALLEL=2"
EOF

sudo systemctl daemon-reload
sudo systemctl restart ollama

# Pull models
ollama pull qwen2.5:14b
ollama pull qwen2.5:7b
```

### Kiểm tra CUDA
```bash
nvidia-smi                        # Verify 2080 Ti detected
ollama run qwen2.5:7b "Xin chào" # Test tiếng Việt
```

### Cấu hình trong LMS
Sau khi Ollama chạy, vào **Admin → AI Config** trong LMS:
```
Name:      question_generator
Base URL:  http://192.168.x.x:11434   # IP server chạy Ollama
Model:     qwen2.5:14b
API Key:   (để trống nếu internal network)
Temperature: 0.3
Max Tokens:  4096
```

---

## Benchmark thực tế ước tính (RTX 2080 Ti)

| Task | Model | Thời gian ước tính |
|------|-------|-------------------|
| Sinh 10 câu hỏi từ 1 trang tài liệu | qwen2.5:14b | ~45-60 giây |
| Sinh outline 5 sections | qwen2.5:14b | ~20-30 giây |
| Sinh script 1 lesson (500 từ) | qwen2.5:14b | ~30-45 giây |
| Wizard chat 1 turn | qwen2.5:7b | ~5-10 giây |

**Ghi chú:** Lần đầu load model vào VRAM mất ~15-30 giây. Các request tiếp theo nhanh hơn 
vì model đã ở trong VRAM (`OLLAMA_KEEP_ALIVE=30m`).

---

## Nếu muốn nâng cấp sau này

Khi hệ thống scale hoặc cần chất lượng cao hơn:

| GPU | Model tối ưu | Cải thiện |
|-----|-------------|-----------|
| RTX 4090 (24GB) | Qwen2.5:32b-Q4 | Chất lượng cao hơn nhiều |
| 2x RTX 3090 (48GB) | Qwen2.5:32b-Q8 | Full quality |
| A100 (80GB) | Qwen2.5:72b | Production grade |

---

## Tóm tắt quyết định

```
✅ PRIMARY:  qwen2.5:14b-Q4_K_M  — sinh câu hỏi, review, phân tích tài liệu
✅ FAST:     qwen2.5:7b-Q8_0     — wizard interactive, response nhanh
❌ SKIP:     Llama3.x, Mistral   — tiếng Việt kém hơn đáng kể
```

**Cài cả 2 model** — dùng model nào tùy config từng AI Config entry trong DB.
Tổng VRAM khi idle: ~9.5GB (chỉ 1 model load tại 1 thời điểm).
