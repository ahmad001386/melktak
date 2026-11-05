with open('src/server/db/postgres.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = 'WHERE customers.id = sub.id AND customers.code IS NULL;    `).catch(()=>{})}'
replacement = '''WHERE customers.id = sub.id AND customers.code IS NULL;    `).catch(()=>{});
    await this.pg.query(`
      UPDATE users SET is_active = false WHERE id = 'c1a11111-9999-9999-9999-999999999999' OR (username = 'superadmin' AND tenant_id = 'e2b17b3c-53f0-466d-9279-d102e5b7b001');
      DELETE FROM sessions WHERE user_id = 'c1a11111-9999-9999-9999-999999999999';
    `).catch(()=>{});
  }'''

if target in text:
    text = text.replace(target, replacement)
    with open('src/server/db/postgres.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Inserted superadmin deactivation migration successfully!')
else:
    print('Target not found in postgres.ts')
