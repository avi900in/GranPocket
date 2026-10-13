from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

pdf_path = "GranPocket Anchor Insurer Strategy.pdf"
doc = SimpleDocTemplate(pdf_path, pagesize=letter, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#0F1A20'),
    spaceAfter=6
)

sub_style = ParagraphStyle(
    'DocSub',
    parent=styles['Normal'],
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#4B5563'),
    spaceAfter=12
)

h2_style = ParagraphStyle(
    'H2',
    parent=styles['Heading2'],
    fontSize=13,
    leading=17,
    textColor=colors.HexColor('#1E3A8A'),
    spaceBefore=12,
    spaceAfter=4
)

h3_style = ParagraphStyle(
    'H3',
    parent=styles['Heading3'],
    fontSize=11,
    leading=15,
    textColor=colors.HexColor('#1E293B'),
    spaceBefore=8,
    spaceAfter=3
)

body_style = ParagraphStyle(
    'Body',
    parent=styles['Normal'],
    fontSize=9,
    leading=13,
    textColor=colors.HexColor('#334155'),
    spaceAfter=4
)

bullet_style = ParagraphStyle(
    'Bullet',
    parent=body_style,
    leftIndent=15,
    firstLineIndent=-10,
    spaceAfter=2
)

code_style = ParagraphStyle(
    'CodeBlock',
    parent=styles['Code'],
    fontSize=7.5,
    leading=10,
    textColor=colors.HexColor('#1E293B'),
    backColor=colors.HexColor('#F8FAFC'),
    spaceAfter=4
)

story = []

story.append(Paragraph("GranPocket: Anchor Insurer Strategy & Enterprise Commercialization Blueprint", title_style))
story.append(Paragraph("Enhanced with Tencent RTC (TRTC) Live Voice Triage & Singapore Integrated Shield Plan Actuarial ROI Model", sub_style))

with open('Granpocket Anchor Insurer Strategy.md', 'r') as f:
    text = f.read()

lines = text.split('\n')
in_code = False
code_buffer = []

for line in lines:
    line_s = line.strip()
    if not line_s:
        continue
    if line_s.startswith('```'):
        if in_code:
            in_code = False
            story.append(Preformatted('\n'.join(code_buffer), code_style))
            code_buffer = []
        else:
            in_code = True
        continue
    if in_code:
        code_buffer.append(line)
        continue
    if line_s.startswith('# '):
        continue
    elif line_s.startswith('## '):
        story.append(Paragraph(line_s[3:], h2_style))
    elif line_s.startswith('### '):
        story.append(Paragraph(line_s[4:], h3_style))
    elif line_s.startswith('#### '):
        story.append(Paragraph(line_s[5:], h3_style))
    elif line_s.startswith('* ') or line_s.startswith('- '):
        clean_bullet = "• " + line_s[2:].replace('**', '')
        story.append(Paragraph(clean_bullet, bullet_style))
    elif line_s.startswith('|'):
        # Table row
        story.append(Paragraph(line_s, code_style))
    else:
        story.append(Paragraph(line_s.replace('**', ''), body_style))

doc.build(story)
print("Successfully generated GranPocket Anchor Insurer Strategy.pdf")
