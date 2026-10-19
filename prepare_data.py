import json
from collections import Counter, defaultdict

with open('egp-contract 68.json', 'r', encoding='utf-8') as f:
    d68 = json.load(f)['data']
with open('egp-contract 69.json', 'r', encoding='utf-8') as f:
    d69 = json.load(f)['data']

MONTH_MAP = {
    'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4,
    'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8,
    'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12
}

FISCAL_MONTHS = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.']

def parse_thai_date(d_str):
    if not d_str or d_str == '-':
        return None
    parts = d_str.strip().split()
    if len(parts) == 3:
        try:
            day = int(parts[0])
            month_str = parts[1]
            year_short = int(parts[2])
            month = MONTH_MAP.get(month_str, 0)
            full_year = 2500 + year_short if year_short < 100 else year_short
            return {'day': day, 'month': month, 'year': full_year, 'month_str': month_str, 'raw': d_str}
        except:
            return None
    return None

def categorize_keyword(name):
    name_l = name.lower()
    if any(k in name_l for k in ['ถนน', 'แอสฟัลท์', 'ลูกรัง', 'จราจร', 'คอนกรีตเสริมเหล็ก', 'คสล', 'ซอย']):
        return 'งานถนนและโครงสร้างพื้นฐาน'
    if any(k in name_l for k in ['นม', 'อาหารเสริม']):
        return 'อาหารเสริม (นมโรงเรียน)'
    if any(k in name_l for k in ['ผู้สูงอายุ', 'คนพิการ', 'ที่อยู่อาศัย', 'สิ่งอำนวยความสะดวก']):
        return 'สวัสดิการสังคมและคนพิการ'
    if any(k in name_l for k in ['คอมพิวเตอร์', 'กล้อง', 'วงจรปิด', 'บัตรประจำตัวประชาชน', 'ระบบ', 'โปรแกรม']):
        return 'เทคโนโลยีและสารสนเทศ'
    if any(k in name_l for k in ['รถ', 'ยานพาหนะ', 'ซ่อมแซม', 'ซ่อม']):
        return 'ยานพาหนะและซ่อมบำรุง'
    if any(k in name_l for k in ['สงกรานต์', 'โอยทาน', 'ประเพณี', 'กิจกรรม', 'งาน']):
        return 'ประเพณี วัฒนธรรม และท่องเที่ยว'
    if any(k in name_l for k in ['เครื่องเล่น', 'ออกกำลังกาย', 'สนาม']):
        return 'นันทนาการและกีฬา'
    if any(k in name_l for k in ['ยุงลาย', 'การแพทย์', 'สาธารณสุข', 'วัคซีน', 'ยา']):
        return 'สาธารณสุขและสุขอนามัย'
    if any(k in name_l for k in ['ท่อระบายน้ำ', 'ระบายน้ำ', 'คู']):
        return 'ระบายน้ำและการชลประทาน'
    if any(k in name_l for k in ['วัสดุ', 'จัดซื้อ', 'อุปกรณ์']):
        return 'วัสดุและอุปกรณ์ทั่วไป'
    return 'บริการและงานอื่นๆ'

def process_year(data_list, year_num):
    clean_projects = []
    
    # Initialize fiscal months
    month_stats = {}
    prev_yr = str(year_num - 1)[-2:]
    curr_yr = str(year_num)[-2:]
    for m in FISCAL_MONTHS:
        yr_label = prev_yr if m in ['ต.ค.', 'พ.ย.', 'ธ.ค.'] else curr_yr
        lbl = f"{m} {yr_label}"
        month_stats[lbl] = {'label': lbl, 'month': m, 'count': 0, 'budget': 0.0, 'agree': 0.0, 'savings': 0.0}
    
    cat_stats = defaultdict(lambda: {'count': 0, 'budget': 0.0, 'agree': 0.0, 'savings': 0.0})
    method_stats = defaultdict(lambda: {'count': 0, 'budget': 0.0, 'agree': 0.0, 'price_build': 0.0, 'savings': 0.0})
    type_stats = defaultdict(lambda: {'count': 0, 'budget': 0.0, 'agree': 0.0, 'savings': 0.0})
    winners_stats = defaultdict(lambda: {'count': 0, 'amount': 0.0, 'tin': '', 'methods': set(), 'projects': []})
    
    tier_stats = {
        'ต่ำกว่า 50,000 บาท': {'count': 0, 'agree': 0.0, 'range': '<50k'},
        '50,000 - 100,000 บาท': {'count': 0, 'agree': 0.0, 'range': '50k-100k'},
        '100,001 - 500,000 บาท': {'count': 0, 'agree': 0.0, 'range': '100k-500k'},
        '500,001 - 1,000,000 บาท': {'count': 0, 'agree': 0.0, 'range': '500k-1M'},
        'มากกว่า 1,000,000 บาท': {'count': 0, 'agree': 0.0, 'range': '>1M'}
    }

    for item in data_list:
        budget = float(item.get('project_money') or 0)
        price_build = float(item.get('price_build') or 0)
        price_agree = float(item.get('sum_price_agree') or 0)
        savings = budget - price_agree
        saving_pct = round(((budget - price_agree)/budget)*100, 2) if budget > 0 else 0
        
        proj_type = item.get('project_type_name') or 'อื่นๆ'
        method = item.get('purchase_method_name') or 'ไม่ระบุ'
        category = categorize_keyword(item.get('project_name', ''))
        
        contract_list = item.get('contract') or []
        winner_name = contract_list[0].get('winner_name') if contract_list else 'ไม่ระบุ'
        winner_tin = contract_list[0].get('winner_tin') if contract_list else ''
        contract_no = contract_list[0].get('contract_no') if contract_list else '-'
        contract_date = contract_list[0].get('contract_date') if contract_list else item.get('transaction_date')
        contract_finish_date = contract_list[0].get('contract_finish_date') if contract_list else '-'
        
        for c in contract_list:
            wn = c.get('winner_name') or 'ไม่ระบุ'
            wt = c.get('winner_tin') or ''
            pa = float(c.get('price_agree') or price_agree)
            winners_stats[wn]['count'] += 1
            winners_stats[wn]['amount'] += pa
            winners_stats[wn]['tin'] = wt
            winners_stats[wn]['methods'].add(method)
            winners_stats[wn]['projects'].append({
                'id': item.get('project_id'),
                'name': item.get('project_name'),
                'price': pa
            })

        if price_agree <= 50000:
            tier_stats['ต่ำกว่า 50,000 บาท']['count'] += 1
            tier_stats['ต่ำกว่า 50,000 บาท']['agree'] += price_agree
        elif price_agree <= 100000:
            tier_stats['50,000 - 100,000 บาท']['count'] += 1
            tier_stats['50,000 - 100,000 บาท']['agree'] += price_agree
        elif price_agree <= 500000:
            tier_stats['100,001 - 500,000 บาท']['count'] += 1
            tier_stats['100,001 - 500,000 บาท']['agree'] += price_agree
        elif price_agree <= 1000000:
            tier_stats['500,001 - 1,000,000 บาท']['count'] += 1
            tier_stats['500,001 - 1,000,000 บาท']['agree'] += price_agree
        else:
            tier_stats['มากกว่า 1,000,000 บาท']['count'] += 1
            tier_stats['มากกว่า 1,000,000 บาท']['agree'] += price_agree

        p_date = parse_thai_date(contract_date or item.get('transaction_date'))
        if p_date and p_date.get('month_str'):
            m_key = f"{p_date['month_str']} {str(p_date['year'])[-2:]}"
            if m_key in month_stats:
                month_stats[m_key]['count'] += 1
                month_stats[m_key]['budget'] += budget
                month_stats[m_key]['agree'] += price_agree
                month_stats[m_key]['savings'] += savings
            else:
                # fallback
                if m_key not in month_stats:
                    month_stats[m_key] = {'label': m_key, 'month': p_date['month_str'], 'count': 0, 'budget': 0.0, 'agree': 0.0, 'savings': 0.0}
                month_stats[m_key]['count'] += 1
                month_stats[m_key]['budget'] += budget
                month_stats[m_key]['agree'] += price_agree
                month_stats[m_key]['savings'] += savings

        cat_stats[category]['count'] += 1
        cat_stats[category]['budget'] += budget
        cat_stats[category]['agree'] += price_agree
        cat_stats[category]['savings'] += savings

        method_stats[method]['count'] += 1
        method_stats[method]['budget'] += budget
        method_stats[method]['agree'] += price_agree
        method_stats[method]['price_build'] += price_build
        method_stats[method]['savings'] += savings

        type_stats[proj_type]['count'] += 1
        type_stats[proj_type]['budget'] += budget
        type_stats[proj_type]['agree'] += price_agree
        type_stats[proj_type]['savings'] += savings

        loc = item.get('project_location') or {}
        lat = loc.get('lat')
        lon = loc.get('lon')

        clean_p = {
            'id': item.get('project_id'),
            'name': item.get('project_name'),
            'type': proj_type,
            'method': method,
            'category': category,
            'budget': budget,
            'price_build': price_build,
            'price_agree': price_agree,
            'savings': savings,
            'saving_pct': saving_pct,
            'status': item.get('project_status') or 'เสร็จสิ้น',
            'dept': item.get('dept_name') or 'เทศบาลเมืองศรีสัชนาลัย',
            'subdistrict': item.get('subdistrict') or 'ท่าชัย',
            'district': item.get('district') or 'ศรีสัชนาลัย',
            'province': item.get('province') or 'สุโขทัย',
            'announce_date': item.get('announce_date') or '-',
            'transaction_date': item.get('transaction_date') or '-',
            'contract_no': contract_no,
            'contract_date': contract_date or '-',
            'contract_finish_date': contract_finish_date,
            'winner_name': winner_name,
            'winner_tin': winner_tin,
            'lat': float(lat) if lat is not None else None,
            'lon': float(lon) if lon is not None else None,
            'year': year_num
        }
        clean_projects.append(clean_p)

    top_winners = []
    for wname, info in sorted(winners_stats.items(), key=lambda kv: kv[1]['amount'], reverse=True)[:30]:
        top_winners.append({
            'name': wname,
            'tin': info['tin'],
            'count': info['count'],
            'amount': round(info['amount'], 2),
            'methods': list(info['methods']),
            'sample_projects': [p['name'] for p in info['projects'][:3]]
        })

    # Sort projects by agree price desc
    clean_projects.sort(key=lambda x: x['price_agree'], reverse=True)

    return {
        'year': year_num,
        'total_count': len(data_list),
        'total_budget': round(sum(p['budget'] for p in clean_projects), 2),
        'total_price_build': round(sum(p['price_build'] for p in clean_projects), 2),
        'total_price_agree': round(sum(p['price_agree'] for p in clean_projects), 2),
        'total_savings': round(sum(p['savings'] for p in clean_projects), 2),
        'avg_project_price': round(sum(p['price_agree'] for p in clean_projects) / len(clean_projects), 2),
        'method_stats': {k: dict(v) for k, v in method_stats.items()},
        'type_stats': {k: dict(v) for k, v in type_stats.items()},
        'cat_stats': {k: dict(v) for k, v in cat_stats.items()},
        'month_stats': month_stats,
        'tier_stats': tier_stats,
        'top_winners': top_winners,
        'projects': clean_projects
    }

res68 = process_year(d68, 2568)
res69 = process_year(d69, 2569)

# Build Combined Statistics
combined_budget = res68['total_budget'] + res69['total_budget']
combined_agree = res68['total_price_agree'] + res69['total_price_agree']
combined_savings = res68['total_savings'] + res69['total_savings']
combined_count = res68['total_count'] + res69['total_count']

# Combined Top Winners
all_winners = defaultdict(lambda: {'count': 0, 'amount': 0.0, 'tin': '', 'years': set(), 'methods': set()})
for p in res68['projects'] + res69['projects']:
    wn = p['winner_name']
    all_winners[wn]['count'] += 1
    all_winners[wn]['amount'] += p['price_agree']
    all_winners[wn]['tin'] = p['winner_tin']
    all_winners[wn]['years'].add(p['year'])
    all_winners[wn]['methods'].add(p['method'])

top_combined_winners = []
for wn, info in sorted(all_winners.items(), key=lambda kv: kv[1]['amount'], reverse=True)[:30]:
    top_combined_winners.append({
        'name': wn,
        'tin': info['tin'],
        'count': info['count'],
        'amount': round(info['amount'], 2),
        'years': list(info['years']),
        'methods': list(info['methods'])
    })

insights_data = {
    'growth': {
        'count_delta': res69['total_count'] - res68['total_count'],
        'count_pct': round(((res69['total_count'] - res68['total_count'])/res68['total_count'])*100, 2),
        'budget_delta': round(res69['total_budget'] - res68['total_budget'], 2),
        'budget_pct': round(((res69['total_budget'] - res68['total_budget'])/res68['total_budget'])*100, 2),
        'agree_delta': round(res69['total_price_agree'] - res68['total_price_agree'], 2),
        'agree_pct': round(((res69['total_price_agree'] - res68['total_price_agree'])/res68['total_price_agree'])*100, 2),
        'avg_price_68': res68['avg_project_price'],
        'avg_price_69': res69['avg_project_price'],
        'avg_price_pct': round(((res69['avg_project_price'] - res68['avg_project_price'])/res68['avg_project_price'])*100, 2)
    },
    'savings': {
        'y68_savings': res68['total_savings'],
        'y68_pct': round((res68['total_savings']/res68['total_budget'])*100, 2),
        'y69_savings': res69['total_savings'],
        'y69_pct': round((res69['total_savings']/res69['total_budget'])*100, 2),
        'ebidding_savings_68': round(res68['method_stats']['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)']['savings'], 2),
        'ebidding_savings_69': round(res69['method_stats']['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)']['savings'], 2),
        'direct_savings_68': round(res68['method_stats']['เฉพาะเจาะจง']['savings'], 2),
        'direct_savings_69': round(res69['method_stats']['เฉพาะเจาะจง']['savings'], 2)
    },
    'pareto': {
        'y68_ebidding_val_pct': round((res68['method_stats']['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)']['agree']/res68['total_price_agree'])*100, 2),
        'y68_ebidding_count_pct': round((res68['method_stats']['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)']['count']/res68['total_count'])*100, 2),
        'y69_ebidding_val_pct': round((res69['method_stats']['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)']['agree']/res69['total_price_agree'])*100, 2),
        'y69_ebidding_count_pct': round((res69['method_stats']['ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)']['count']/res69['total_count'])*100, 2)
    }
}

output_package = {
    'summary': {
        'y68': {k: v for k, v in res68.items() if k != 'projects'},
        'y69': {k: v for k, v in res69.items() if k != 'projects'},
        'combined': {
            'total_count': combined_count,
            'total_budget': round(combined_budget, 2),
            'total_price_agree': round(combined_agree, 2),
            'total_savings': round(combined_savings, 2),
            'top_winners': top_combined_winners
        },
        'insights': insights_data
    },
    'projects68': res68['projects'],
    'projects69': res69['projects']
}

with open('dashboard_data.json', 'w', encoding='utf-8') as f:
    json.dump(output_package, f, ensure_ascii=False, indent=2)

js_content = "window.DASHBOARD_DATA = " + json.dumps(output_package, ensure_ascii=False) + ";"
with open('data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Data processed successfully! 68 projects: {len(res68['projects'])}, 69 projects: {len(res69['projects'])}")
