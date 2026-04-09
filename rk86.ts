// @bun
// src/lib/hex.ts
function hex(v, prefix) {
  return v.toString(16).toUpperCase();
}
function hex8(v, prefix) {
  return (prefix ? prefix : "") + hex(v & 255, prefix).padStart(2, "0");
}
function hex16(v, prefix) {
  return (prefix ? prefix : "") + hex(v & 65535, prefix).padStart(4, "0");
}
function hexArray(array) {
  return array.map((c) => hex8(c)).join(" ");
}
function fromHex(v) {
  if (typeof v === "string") {
    return v.startsWith("0x") ? parseInt(v, 16) : parseInt(v);
  }
  return v;
}

// src/lib/i8080.ts
class I8080 {
  memory;
  io;
  sp = 0;
  pc = 0;
  iff = 0;
  pf = 0;
  hf = 0;
  sf = 0;
  zf = 0;
  cf = 0;
  regs = [0, 0, 0, 0, 0, 0, 0, 0];
  static F_CARRY = 1;
  static F_UN1 = 2;
  static F_PARITY = 4;
  static F_UN3 = 8;
  static F_HCARRY = 16;
  static F_UN5 = 32;
  static F_ZERO = 64;
  static F_NEG = 128;
  parity_table = [
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1]
  ].flat();
  half_carry_table = [0, 0, 1, 0, 1, 0, 1, 1];
  sub_half_carry_table = [0, 1, 1, 1, 0, 0, 0, 1];
  constructor(machine) {
    this.memory = machine.memory;
    this.io = machine.io;
  }
  export() {
    const h8 = (n) => "0x" + hex8(n);
    const h16 = (n) => "0x" + hex16(n);
    return {
      a: h8(this.a()),
      sf: this.sf ? 1 : 0,
      zf: this.zf ? 1 : 0,
      hf: this.hf ? 1 : 0,
      pf: this.pf ? 1 : 0,
      cf: this.cf ? 1 : 0,
      bc: h16(this.bc()),
      de: h16(this.de()),
      hl: h16(this.hl()),
      sp: h16(this.sp),
      pc: h16(this.pc),
      iff: this.iff ? 1 : 0
    };
  }
  import(snapshot) {
    const h = fromHex;
    this.set_a(h(snapshot.a));
    this.sf = snapshot.sf;
    this.zf = snapshot.zf;
    this.hf = snapshot.hf;
    this.pf = snapshot.pf;
    this.cf = snapshot.cf;
    this.set_rp(0, h(snapshot.bc));
    this.set_rp(2, h(snapshot.de));
    this.set_rp(4, h(snapshot.hl));
    this.set_rp(6, h(snapshot.sp));
    this.pc = h(snapshot.pc);
    this.iff = h(snapshot.iff);
  }
  memory_read_byte(addr) {
    return this.memory.read(addr & 65535) & 255;
  }
  memory_write_byte(addr, w8) {
    this.memory.write(addr & 65535, w8 & 255);
  }
  memory_read_word(addr) {
    return this.memory_read_byte(addr + 1) << 8 | this.memory_read_byte(addr);
  }
  memory_write_word(addr, w16) {
    this.memory_write_byte(addr + 1, w16 >> 8);
    this.memory_write_byte(addr, w16 & 255);
  }
  reg(r) {
    return r != 6 ? this.regs[r] : this.memory_read_byte(this.hl());
  }
  set_reg(r, value) {
    const v8 = value & 255;
    if (r != 6)
      this.regs[r] = v8;
    else
      this.memory_write_byte(this.hl(), v8);
  }
  rp(r) {
    return r != 6 ? this.regs[r] << 8 | this.regs[r + 1] : this.sp;
  }
  set_rp(r, w16) {
    if (r != 6) {
      this.set_reg(r, w16 >> 8);
      this.set_reg(r + 1, w16 & 255);
    } else
      this.sp = w16;
  }
  store_flags() {
    let f = 0;
    if (this.sf)
      f |= I8080.F_NEG;
    else
      f &= ~I8080.F_NEG;
    if (this.zf)
      f |= I8080.F_ZERO;
    else
      f &= ~I8080.F_ZERO;
    if (this.hf)
      f |= I8080.F_HCARRY;
    else
      f &= ~I8080.F_HCARRY;
    if (this.pf)
      f |= I8080.F_PARITY;
    else
      f &= ~I8080.F_PARITY;
    if (this.cf)
      f |= I8080.F_CARRY;
    else
      f &= ~I8080.F_CARRY;
    f |= I8080.F_UN1;
    f &= ~I8080.F_UN3;
    f &= ~I8080.F_UN5;
    return f;
  }
  retrieve_flags(f) {
    this.sf = f & I8080.F_NEG ? 1 : 0;
    this.zf = f & I8080.F_ZERO ? 1 : 0;
    this.hf = f & I8080.F_HCARRY ? 1 : 0;
    this.pf = f & I8080.F_PARITY ? 1 : 0;
    this.cf = f & I8080.F_CARRY ? 1 : 0;
  }
  bc() {
    return this.rp(0);
  }
  de() {
    return this.rp(2);
  }
  hl() {
    return this.rp(4);
  }
  b() {
    return this.reg(0);
  }
  c() {
    return this.reg(1);
  }
  d() {
    return this.reg(2);
  }
  e() {
    return this.reg(3);
  }
  h() {
    return this.reg(4);
  }
  l() {
    return this.reg(5);
  }
  a() {
    return this.reg(7);
  }
  set_b(v) {
    this.set_reg(0, v);
  }
  set_c(v) {
    this.set_reg(1, v);
  }
  set_d(v) {
    this.set_reg(2, v);
  }
  set_e(v) {
    this.set_reg(3, v);
  }
  set_h(v) {
    this.set_reg(4, v);
  }
  set_l(v) {
    this.set_reg(5, v);
  }
  set_a(v) {
    this.set_reg(7, v);
  }
  next_pc_byte() {
    const v = this.memory_read_byte(this.pc);
    this.pc = this.pc + 1 & 65535;
    return v;
  }
  next_pc_word() {
    return this.next_pc_byte() | this.next_pc_byte() << 8;
  }
  inr(r) {
    let v = this.reg(r);
    v = v + 1 & 255;
    this.set_reg(r, v);
    this.sf = (v & 128) != 0 ? 1 : 0;
    this.zf = v == 0 ? 1 : 0;
    this.hf = (v & 15) == 0 ? 1 : 0;
    this.pf = this.parity_table[v];
  }
  dcr(r) {
    let v = this.reg(r);
    v = v - 1 & 255;
    this.set_reg(r, v);
    this.sf = (v & 128) != 0 ? 1 : 0;
    this.zf = v == 0 ? 1 : 0;
    this.hf = !((v & 15) == 15) ? 1 : 0;
    this.pf = this.parity_table[v];
  }
  add_im8(v, carry) {
    let a = this.a();
    const w16 = a + v + carry;
    const index = (a & 136) >> 1 | (v & 136) >> 2 | (w16 & 136) >> 3;
    a = w16 & 255;
    this.sf = (a & 128) != 0 ? 1 : 0;
    this.zf = a == 0 ? 1 : 0;
    this.hf = this.half_carry_table[index & 7] ? 1 : 0;
    this.pf = this.parity_table[a] ? 1 : 0;
    this.cf = (w16 & 256) != 0 ? 1 : 0;
    this.set_a(a);
  }
  add(r, carry) {
    this.add_im8(this.reg(r), carry);
  }
  sub_im8(v, carry) {
    let a = this.a();
    const w16 = a - v - carry & 65535;
    const index = (a & 136) >> 1 | (v & 136) >> 2 | (w16 & 136) >> 3;
    a = w16 & 255;
    this.sf = (a & 128) != 0 ? 1 : 0;
    this.zf = a == 0 ? 1 : 0;
    this.hf = !this.sub_half_carry_table[index & 7] ? 1 : 0;
    this.pf = this.parity_table[a] ? 1 : 0;
    this.cf = (w16 & 256) != 0 ? 1 : 0;
    this.set_a(a);
  }
  sub(r, carry) {
    this.sub_im8(this.reg(r), carry);
  }
  cmp_im8(v) {
    const a = this.a();
    this.sub_im8(v, 0);
    this.set_a(a);
  }
  cmp(r) {
    this.cmp_im8(this.reg(r));
  }
  ana_im8(v) {
    let a = this.a();
    this.hf = ((a | v) & 8) != 0 ? 1 : 0;
    a &= v;
    this.sf = (a & 128) != 0 ? 1 : 0;
    this.zf = a == 0 ? 1 : 0;
    this.pf = this.parity_table[a] ? 1 : 0;
    this.cf = 0;
    this.set_a(a);
  }
  ana(r) {
    this.ana_im8(this.reg(r));
  }
  xra_im8(v) {
    let a = this.a();
    a ^= v;
    this.sf = (a & 128) != 0 ? 1 : 0;
    this.zf = a == 0 ? 1 : 0;
    this.hf = 0;
    this.pf = this.parity_table[a];
    this.cf = 0;
    this.set_a(a);
  }
  xra(r) {
    this.xra_im8(this.reg(r));
  }
  ora_im8(v) {
    let a = this.a();
    a |= v;
    this.sf = (a & 128) != 0 ? 1 : 0;
    this.zf = a == 0 ? 1 : 0;
    this.hf = 0;
    this.pf = this.parity_table[a];
    this.cf = 0;
    this.set_a(a);
  }
  ora(r) {
    this.ora_im8(this.reg(r));
  }
  dad(r) {
    const hl = this.hl() + this.rp(r);
    this.cf = (hl & 65536) != 0 ? 1 : 0;
    this.set_h(hl >> 8);
    this.set_l(hl & 255);
  }
  call(w16) {
    this.push(this.pc);
    this.pc = w16;
  }
  ret() {
    return this.pc = this.pop();
  }
  pop() {
    const v = this.memory_read_word(this.sp);
    this.sp = this.sp + 2 & 65535;
    return v;
  }
  push(v) {
    this.sp = this.sp - 2 & 65535;
    this.memory_write_word(this.sp, v);
  }
  rst(addr) {
    this.push(this.pc);
    this.pc = addr;
  }
  execute(opcode) {
    let cpu_cycles = -1;
    switch (opcode) {
      default:
        alert("Oops! Unhandled opcode " + opcode.toString(16));
        break;
      case 0:
      case 8:
      case 16:
      case 24:
      case 32:
      case 40:
      case 48:
      case 56:
        cpu_cycles = 4;
        break;
      case 1:
      case 17:
      case 33:
      case 49:
        cpu_cycles = 10;
        this.set_rp(opcode >> 3, this.next_pc_word());
        break;
      case 2:
      case 18:
        cpu_cycles = 7;
        this.memory_write_byte(this.rp(opcode >> 3), this.a());
        break;
      case 3:
      case 19:
      case 35:
      case 51: {
        cpu_cycles = 5;
        const r = opcode >> 3;
        this.set_rp(r, this.rp(r) + 1 & 65535);
        break;
      }
      case 4:
      case 12:
      case 20:
      case 28:
      case 36:
      case 44:
      case 52:
      case 60:
        cpu_cycles = opcode != 52 ? 5 : 10;
        this.inr(opcode >> 3);
        break;
      case 5:
      case 13:
      case 21:
      case 29:
      case 37:
      case 45:
      case 53:
      case 61:
        cpu_cycles = opcode != 53 ? 5 : 10;
        this.dcr(opcode >> 3);
        break;
      case 6:
      case 14:
      case 22:
      case 30:
      case 38:
      case 46:
      case 54:
      case 62:
        cpu_cycles = opcode != 54 ? 7 : 10;
        this.set_reg(opcode >> 3, this.next_pc_byte());
        break;
      case 7: {
        cpu_cycles = 4;
        const a = this.a();
        this.cf = (a & 128) != 0 ? 1 : 0;
        this.set_a(a << 1 & 255 | this.cf);
        break;
      }
      case 9:
      case 25:
      case 41:
      case 57:
        cpu_cycles = 10;
        this.dad((opcode & 48) >> 3);
        break;
      case 10:
      case 26: {
        cpu_cycles = 7;
        const r = (opcode & 16) >> 3;
        this.set_a(this.memory_read_byte(this.rp(r)));
        break;
      }
      case 11:
      case 27:
      case 43:
      case 59: {
        cpu_cycles = 5;
        const r = (opcode & 48) >> 3;
        this.set_rp(r, this.rp(r) - 1 & 65535);
        break;
      }
      case 15:
        cpu_cycles = 4;
        this.cf = this.a() & 1;
        this.set_a(this.a() >> 1 | this.cf << 7);
        break;
      case 23: {
        cpu_cycles = 4;
        const w8 = this.cf;
        this.cf = (this.a() & 128) != 0 ? 1 : 0;
        this.set_a(this.a() << 1 | w8);
        break;
      }
      case 31: {
        cpu_cycles = 4;
        const w8 = this.cf;
        this.cf = this.a() & 1;
        this.set_a(this.a() >> 1 | w8 << 7);
        break;
      }
      case 34: {
        cpu_cycles = 16;
        const w16 = this.next_pc_word();
        this.memory_write_byte(w16, this.l());
        this.memory_write_byte(w16 + 1, this.h());
        break;
      }
      case 39: {
        cpu_cycles = 4;
        let carry = this.cf;
        let add = 0;
        const a = this.a();
        if (this.hf || (a & 15) > 9)
          add = 6;
        if (this.cf || a >> 4 > 9 || a >> 4 >= 9 && (a & 15) > 9) {
          add |= 96;
          carry = 1;
        }
        this.add_im8(add, 0);
        this.pf = this.parity_table[this.a()];
        this.cf = carry;
        break;
      }
      case 42: {
        cpu_cycles = 16;
        const w16 = this.next_pc_word();
        this.regs[5] = this.memory_read_byte(w16);
        this.regs[4] = this.memory_read_byte(w16 + 1);
        break;
      }
      case 47:
        cpu_cycles = 4;
        this.set_a(this.a() ^ 255);
        break;
      case 50:
        cpu_cycles = 13;
        this.memory_write_byte(this.next_pc_word(), this.a());
        break;
      case 55:
        cpu_cycles = 4;
        this.cf = 1;
        break;
      case 58:
        cpu_cycles = 13;
        this.set_a(this.memory_read_byte(this.next_pc_word()));
        break;
      case 63:
        cpu_cycles = 4;
        this.cf = this.cf ? 0 : 1;
        break;
      case 64:
      case 65:
      case 66:
      case 67:
      case 68:
      case 69:
      case 70:
      case 71:
      case 72:
      case 73:
      case 74:
      case 75:
      case 76:
      case 77:
      case 78:
      case 79:
      case 80:
      case 81:
      case 82:
      case 83:
      case 84:
      case 85:
      case 86:
      case 87:
      case 88:
      case 89:
      case 90:
      case 91:
      case 92:
      case 93:
      case 94:
      case 95:
      case 96:
      case 97:
      case 98:
      case 99:
      case 100:
      case 101:
      case 102:
      case 103:
      case 104:
      case 105:
      case 106:
      case 107:
      case 108:
      case 109:
      case 110:
      case 111:
      case 112:
      case 113:
      case 114:
      case 115:
      case 116:
      case 117:
      case 119:
      case 120:
      case 121:
      case 122:
      case 123:
      case 124:
      case 125:
      case 126:
      case 127: {
        const src = opcode & 7;
        const dst = opcode >> 3 & 7;
        cpu_cycles = src == 6 || dst == 6 ? 7 : 5;
        this.set_reg(dst, this.reg(src));
        break;
      }
      case 118:
        cpu_cycles = 4;
        this.pc = this.pc - 1 & 65535;
        break;
      case 128:
      case 129:
      case 130:
      case 131:
      case 132:
      case 133:
      case 134:
      case 135:
      case 136:
      case 137:
      case 138:
      case 139:
      case 140:
      case 141:
      case 142:
      case 143: {
        const r = opcode & 7;
        cpu_cycles = r != 6 ? 4 : 7;
        this.add(r, opcode & 8 ? this.cf : 0);
        break;
      }
      case 144:
      case 145:
      case 146:
      case 147:
      case 148:
      case 149:
      case 150:
      case 151:
      case 152:
      case 153:
      case 154:
      case 155:
      case 156:
      case 157:
      case 158:
      case 159: {
        const r = opcode & 7;
        cpu_cycles = r != 6 ? 4 : 7;
        this.sub(r, opcode & 8 ? this.cf : 0);
        break;
      }
      case 160:
      case 161:
      case 162:
      case 163:
      case 164:
      case 165:
      case 166:
      case 167: {
        const r = opcode & 7;
        cpu_cycles = r != 6 ? 4 : 7;
        this.ana(r);
        break;
      }
      case 168:
      case 169:
      case 170:
      case 171:
      case 172:
      case 173:
      case 174:
      case 175: {
        const r = opcode & 7;
        cpu_cycles = r != 6 ? 4 : 7;
        this.xra(r);
        break;
      }
      case 176:
      case 177:
      case 178:
      case 179:
      case 180:
      case 181:
      case 182:
      case 183: {
        const r = opcode & 7;
        cpu_cycles = r != 6 ? 4 : 7;
        this.ora(r);
        break;
      }
      case 184:
      case 185:
      case 186:
      case 187:
      case 188:
      case 189:
      case 190:
      case 191: {
        const r = opcode & 7;
        cpu_cycles = r != 6 ? 4 : 7;
        this.cmp(r);
        break;
      }
      case 192:
      case 200:
      case 208:
      case 216:
      case 224:
      case 232:
      case 240:
      case 248: {
        const flags = [this.zf, this.cf, this.pf, this.sf];
        const r = opcode >> 4 & 3;
        const direction = (opcode & 8) != 0 ? 1 : 0;
        cpu_cycles = 5;
        if (flags[r] == direction) {
          cpu_cycles = 11;
          this.ret();
        }
        break;
      }
      case 193:
      case 209:
      case 225:
      case 241: {
        cpu_cycles = 11;
        const r = (opcode & 48) >> 3;
        const w16 = this.pop();
        if (r != 6) {
          this.set_rp(r, w16);
        } else {
          this.set_a(w16 >> 8);
          this.retrieve_flags(w16 & 255);
        }
        break;
      }
      case 194:
      case 202:
      case 210:
      case 218:
      case 226:
      case 234:
      case 242:
      case 250: {
        cpu_cycles = 10;
        const flags = [this.zf, this.cf, this.pf, this.sf];
        const r = opcode >> 4 & 3;
        const direction = (opcode & 8) != 0 ? 1 : 0;
        const w16 = this.next_pc_word();
        this.pc = flags[r] == direction ? w16 : this.pc;
        break;
      }
      case 195:
      case 203:
        cpu_cycles = 10;
        this.pc = this.next_pc_word();
        break;
      case 196:
      case 204:
      case 212:
      case 220:
      case 228:
      case 236:
      case 244:
      case 252: {
        const flags = [this.zf, this.cf, this.pf, this.sf];
        const r = opcode >> 4 & 3;
        const direction = (opcode & 8) != 0 ? 1 : 0;
        const w16 = this.next_pc_word();
        cpu_cycles = 11;
        if (flags[r] == direction) {
          cpu_cycles = 17;
          this.call(w16);
        }
        break;
      }
      case 197:
      case 213:
      case 229:
      case 245: {
        cpu_cycles = 11;
        const r = (opcode & 48) >> 3;
        const w16 = r != 6 ? this.rp(r) : this.a() << 8 | this.store_flags();
        this.push(w16);
        break;
      }
      case 198:
        cpu_cycles = 7;
        this.add_im8(this.next_pc_byte(), 0);
        break;
      case 199:
      case 207:
      case 215:
      case 223:
      case 231:
      case 239:
      case 247:
      case 255:
        this.rst(opcode & 56);
        cpu_cycles = 11;
        break;
      case 201:
      case 217:
        cpu_cycles = 10;
        this.ret();
        break;
      case 205:
      case 221:
      case 237:
      case 253:
        cpu_cycles = 17;
        this.call(this.next_pc_word());
        break;
      case 206:
        cpu_cycles = 7;
        this.add_im8(this.next_pc_byte(), this.cf);
        break;
      case 211:
        cpu_cycles = 10;
        this.io.output(this.next_pc_byte(), this.a());
        break;
      case 214:
        cpu_cycles = 7;
        this.sub_im8(this.next_pc_byte(), 0);
        break;
      case 219:
        cpu_cycles = 10;
        this.set_a(this.io.input(this.next_pc_byte()));
        break;
      case 222:
        cpu_cycles = 7;
        this.sub_im8(this.next_pc_byte(), this.cf);
        break;
      case 227: {
        cpu_cycles = 18;
        const w16 = this.memory_read_word(this.sp);
        this.memory_write_word(this.sp, this.hl());
        this.set_l(w16 & 255);
        this.set_h(w16 >> 8);
        break;
      }
      case 230:
        cpu_cycles = 7;
        this.ana_im8(this.next_pc_byte());
        break;
      case 233:
        cpu_cycles = 5;
        this.pc = this.hl();
        break;
      case 235: {
        cpu_cycles = 4;
        const l = this.l();
        this.set_l(this.e());
        this.set_e(l);
        const h = this.h();
        this.set_h(this.d());
        this.set_d(h);
        break;
      }
      case 238:
        cpu_cycles = 7;
        this.xra_im8(this.next_pc_byte());
        break;
      case 243:
      case 251:
        cpu_cycles = 4;
        this.iff = (opcode & 8) != 0 ? 1 : 0;
        this.io.interrupt(this.iff);
        break;
      case 246:
        cpu_cycles = 7;
        this.ora_im8(this.next_pc_byte());
        break;
      case 249:
        cpu_cycles = 5;
        this.sp = this.hl();
        break;
      case 254:
        cpu_cycles = 7;
        this.cmp_im8(this.next_pc_byte());
        break;
    }
    return cpu_cycles;
  }
  instruction() {
    return this.execute(this.next_pc_byte());
  }
  jump(addr) {
    this.pc = addr & 65535;
  }
}

// src/lib/rk86_file_parser.ts
var extract_rk86_word = function(v, i) {
  return (v[i] & 255) << 8 | v[i + 1] & 255;
};
var to_text = (binary) => binary.reduce((a, x) => a + String.fromCharCode(x), "");
var is_hex_file = (image) => to_text(image.slice(0, 6)) === "#!rk86";
var convert_hex_to_binary = function(text) {
  const lines = text.split(`
`).filter((line) => line.trim().length).filter((line) => !line.startsWith(";") && !line.startsWith("#"));
  const image = [];
  for (const line of lines) {
    const hex_line = line.slice(5).trim();
    const binary_line = hex_line.split(" ").map((v) => parseInt(v, 16));
    image.push(...binary_line);
  }
  return image;
};
var file_ext = (filename) => {
  const groups = filename.match(".*\\.(.*)$");
  return groups ? groups[1] : "";
};
var parse_rk86_binary = (name, input) => {
  let file = {};
  file.name = name.split("/").slice(-1)[0];
  let image = input;
  if (is_hex_file(image)) {
    const text = to_text(image);
    image = convert_hex_to_binary(text);
    file = { ...file, ...extact_metadata(text) };
    if (file.start != null)
      file.start = parseInt(file.start, 16);
    if (file.entry != null)
      file.entry = parseInt(file.entry, 16);
  }
  if (image.length > 65536) {
    throw new Error(`\u043E\u0448\u0438\u0431\u043A\u0430: \u0434\u043B\u0438\u043D\u0430 \u0444\u0430\u0439\u043B\u0430 [${file.name}] ${image.length} \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 65556`);
  }
  const ext = file_ext(file.name);
  if (ext === "bin" || ext === "") {
    file.size = image.length;
    if (file.start == null) {
      file.start = file.name.match(/^mon/) ? 65536 - file.size : 0;
    }
    file.end = file.start + file.size - 1;
    file.image = image;
    if (file.entry == null) {
      file.entry = file.start;
    }
  } else {
    let i = 0;
    if ((image[i] & 255) == 230)
      ++i;
    file.start = extract_rk86_word(image, i);
    file.end = extract_rk86_word(image, i + 2);
    i += 4;
    file.size = file.end - file.start + 1;
    file.image = image.slice(i, i + file.size);
    file.entry = file.entry != null ? file.entry : file.start;
    if (file.name == "PVO.GAM")
      file.entry = 13312;
  }
  return file;
};
function extact_metadata(text) {
  const initial = {};
  return [...text.matchAll(/!([^ =\t\n\r]+?)=([^ \t\r\n]+)/g)].map((group) => group.slice(1)).reduce((a, [key, value]) => (a[key] = value, a), initial);
}

// src/lib/rk86_font.ts
function rk86_font_image() {
  return "data:image/bmp;base64," + "Qk0+IAAAAAAAAD4AAAAoAAAACAAAAAAIAAABAAEAAAAAAAAgAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAP///wAAAAAAGAAAABgAAAB+AAAAfgAAABgAAAAYAAAA" + "AAAAAAAAAAABAAAAAQAAAA8AAAAJAAAACQAAAAAAAAAAAAAAAQAAAD8AAAAq" + "AAAAKgAAACoAAAAqAAAAAAAAAAAAAAAAAAAADgAAAAEAAAAHAAAAAQAAAA4A" + "AAAAAAAAAAAAAAAAAAAfAAAAFQAAABUAAAAVAAAAFQAAAAAAAAAAAAAAAAAA" + "AA4AAAABAAAAAgAAAAkAAAAGAAAAAAAAAAAAAAAAAAAAGQAAABUAAAAZAAAA" + "EQAAABEAAAAAAAAAAAAAAAAAAAAOAAAACQAAAA4AAAAIAAAACAAAAAAAAAAA" + "AAAAAAAAAA4AAAAJAAAADgAAAAkAAAAOAAAAAAAAAAAAAAAAAAAAFQAAABUA" + "AAAOAAAAFQAAABUAAAAAAAAAAAAAAAAAAAAOAAAAAQAAAAcAAAAJAAAACQAA" + "AAAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAAAAfAAAAAAAAAAAAAAAAAAAA" + "BwAAAAgAAAAIAAAACAAAAAcAAAAAAAAAAAAAAAgAAAAIAAAACAAAAA4AAAAJ" + "AAAADgAAAAAAAAAAAAAAAAAAAAkAAAAFAAAABwAAAAkAAAAHAAAAAAAAAAAA" + "AAAAAAAACQAAAAkAAAAJAAAACQAAAA8AAAAAAAAAAAAAAAAAAAAGAAAACQAA" + "AAkAAAAJAAAABgAAAAAAAAAAAAAAAAAAAAkAAAAJAAAADwAAAAkAAAAJAAAA" + "AAAAAAAAAAAAAAAAEQAAABUAAAAVAAAAGwAAABEAAAAAAAAAAAAAAAAAAAAJ" + "AAAACQAAAAkAAAAFAAAAAwAAAAAAAAAAAAAAAAAAAAkAAAAKAAAADAAAAAoA" + "AAAJAAAAAAAAAAAAAAAAAAAACQAAAA0AAAALAAAACQAAAAkAAAAAAAAABgAA" + "AAAAAAAJAAAADQAAAAsAAAAJAAAACQAAAAAAAAAAAAAAAAAAAAkAAAAJAAAA" + "BgAAAAYAAAAJAAAAAAAAAAAAAAAAAAAACAAAAAgAAAAIAAAACAAAAA8AAAAA" + "AAAAAAAAAAQAAAAEAAAADgAAABUAAAAOAAAABAAAAAAAAAAAAAAAAAAAAAcA" + "AAAIAAAADgAAAAkAAAAGAAAAAAAAAAAAAAAAAAAADwAAAAEAAAAHAAAACQAA" + "AAYAAAAAAAAAAAAAAAEAAAAfAAAAEgAAABIAAAASAAAAEgAAAAAAAAAAAAAA" + "AAAAAA4AAAAJAAAADgAAAAgAAAAHAAAAAAAAAAAAAAAAAAAABgAAAAkAAAAH" + "AAAAAQAAAA4AAAAAAAAAAAAAAAAAAAASAAAAFQAAAB0AAAAVAAAAEgAAAAAA" + "AAAAAAAAAAAAAAQAAAAMAAAAHgAAAD8AAAAeAAAADAAAAAgAAAAAAAAAAQAA" + "AAMAAAAPAAAADAAAAAgAAAAAAAAAAAAAAAAAAAARAAAACAAAAAgAAAAEAAAA" + "CAAAAAgAAAAQAAAAAAAAAAgAAAAIAAAACAAAAAAAAAAIAAAACAAAAAgAAAAA" + "AAAAAQAAAAIAAAACAAAABAAAAAIAAAACAAAAAQAAAAAAAAAPAAAACAAAAAYA" + "AAABAAAADwAAAAAAAAAAAAAAAAAAAA4AAAABAAAABwAAAAkAAAAJAAAAAAAA" + "AAAAAAAAAAAAEQAAAAoAAAACAAAACgAAABEAAAAAAAAAAAAAAAAAAAAKAAAA" + "FQAAABUAAAARAAAAEQAAAAAAAAAAAAAAAAAAAAQAAAAKAAAAEQAAABEAAAAR" + "AAAAAAAAAAAAAAAAAAAADgAAABEAAAARAAAAEQAAABEAAAAAAAAAAAAAAAAA" + "AAAGAAAACQAAAAgAAAAIAAAAHAAAAAgAAAAIAAAAAAAAAA4AAAABAAAABgAA" + "AAgAAAAHAAAAAAAAAAAAAAAAAAAACAAAAAgAAAAIAAAACQAAAA4AAAAAAAAA" + "AAAAAAAAAAABAAAABwAAAAkAAAAJAAAABwAAAAAAAAAAAAAAAAAAAAgAAAAO" + "AAAACQAAAAkAAAAOAAAAAAAAAAAAAAAAAAAABgAAAAkAAAAJAAAACQAAAAYA" + "AAAAAAAAAAAAAAAAAAAJAAAACQAAAAkAAAAJAAAADgAAAAAAAAAAAAAAAAAA" + "ABUAAAAVAAAAFQAAABUAAAAaAAAAAAAAAAAAAAAAAAAABwAAAAIAAAACAAAA" + "AgAAAAIAAAACAAAABgAAAAAAAAAJAAAACgAAAAwAAAAKAAAACQAAAAgAAAAI" + "AAAAAAAAAAYAAAAJAAAAAQAAAAEAAAABAAAAAAAAAAEAAAAAAAAABwAAAAIA" + "AAACAAAAAgAAAAYAAAAAAAAAAgAAAAAAAAAJAAAACQAAAAkAAAAJAAAADgAA" + "AAgAAAAIAAAAAAAAAA4AAAABAAAABwAAAAkAAAAHAAAAAAAAAAAAAAAAAAAA" + "CAAAAAgAAAAIAAAAHAAAAAgAAAAJAAAABgAAAAAAAAAHAAAACAAAAA4AAAAJ" + "AAAABgAAAAAAAAAAAAAAAAAAAAcAAAAJAAAACQAAAAkAAAAHAAAAAQAAAAEA" + "AAAAAAAABwAAAAgAAAAIAAAACAAAAAcAAAAAAAAAAAAAAAAAAAAOAAAACQAA" + "AAkAAAAJAAAADgAAAAgAAAAIAAAAAAAAAA0AAAASAAAAEgAAABIAAAAOAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAIAAAAEAAAAAAAAAAE" + "AAAAAAAAAAQAAAACAAAAAQAAABEAAAAOAAAAAAAAAAgAAAAEAAAAAgAAAAEA" + "AAACAAAABAAAAAgAAAAAAAAAAAAAAAAAAAAfAAAAAAAAAB8AAAAAAAAAAAAA" + "AAAAAAACAAAABAAAAAgAAAAQAAAACAAAAAQAAAACAAAAAAAAAAgAAAAEAAAA" + "DAAAAAwAAAAAAAAADAAAAAwAAAAAAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAM" + "AAAAAAAAAAAAAAAcAAAAAgAAAAEAAAAPAAAAEQAAABEAAAAOAAAAAAAAAA4A" + "AAARAAAAEQAAAA4AAAARAAAAEQAAAA4AAAAAAAAACAAAAAgAAAAIAAAABAAA" + "AAIAAAABAAAAHwAAAAAAAAAOAAAAEQAAABEAAAAeAAAAEAAAAAgAAAAHAAAA" + "AAAAAA4AAAARAAAAAQAAAAEAAAAeAAAAEAAAAB8AAAAAAAAAAgAAAAIAAAAf" + "AAAAEgAAAAoAAAAGAAAAAgAAAAAAAAAOAAAAEQAAAAEAAAAGAAAAAgAAAAEA" + "AAAfAAAAAAAAAB8AAAAQAAAACAAAAAYAAAABAAAAEQAAAA4AAAAAAAAADgAA" + "AAQAAAAEAAAABAAAAAQAAAAMAAAABAAAAAAAAAAOAAAAEQAAABkAAAAVAAAA" + "EwAAABEAAAAOAAAAAAAAAAAAAAAQAAAACAAAAAQAAAACAAAAAQAAAAAAAAAA" + "AAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAfAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAEAAAADAAAAAwAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAQAAAAEAAAAHwAAAAQAAAAEAAAAAAAAAAAAAAAAAAAA" + "BAAAABUAAAAOAAAAFQAAAAQAAAAAAAAAAAAAAAgAAAAEAAAAAgAAAAIAAAAC" + "AAAABAAAAAgAAAAAAAAAAgAAAAQAAAAIAAAACAAAAAgAAAAEAAAAAgAAAAAA" + "AAAAAAAAAAAAAAAAAAAEAAAAAgAAAAYAAAAGAAAAAAAAAA0AAAASAAAAFQAA" + "AAwAAAAKAAAACgAAAAQAAAAAAAAAAwAAABMAAAAIAAAABAAAAAIAAAAZAAAA" + "GAAAAAAAAAAEAAAAHgAAAAUAAAAOAAAAFAAAAA8AAAAEAAAAAAAAAAoAAAAK" + "AAAAHwAAAAoAAAAfAAAACgAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoA" + "AAAKAAAACgAAAAAAAAAEAAAAAAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAUAAAAFAAAABQAAAD0AAAAnAAAAIAAAACAAAAA4" + "AAAABAAAAAwAAAAdAAAAPwAAAD8AAAAdAAAADAAAAAQAAAAAAAAAAAAAAAAA" + "AAA/AAAAPwAAAAAAAAAAAAAAAAAAAAwAAAAMAAAADAAAAAwAAAAMAAAADAAA" + "AAwAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAPwAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAPwAAAD8A" + "AAA/AAAAPwAAAD8AAAA/AAAABwAAAAcAAAAHAAAABwAAAD8AAAA/AAAAPwAA" + "AD8AAAA4AAAAOAAAADgAAAA4AAAAPwAAAD8AAAA/AAAAPwAAAAAAAAAAAAAA" + "AAAAAAAAAAA4AAAAOAAAADgAAAA4AAAAPwAAAD8AAAA/AAAAPwAAADgAAAA4" + "AAAAOAAAADgAAAAHAAAABwAAAAcAAAAHAAAAOAAAADgAAAA4AAAAOAAAADgA" + "AAA4AAAAOAAAADgAAAA4AAAAOAAAADgAAAA4AAAAAAAAAAAAAAAAAAAAAAAA" + "AAwAAAAeAAAAPwAAAAwAAAAMAAAADAAAAAwAAAAMAAAACAAAAAwAAAAuAAAA" + "PwAAAD8AAAAuAAAADAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAwA" + "AAAMAAAADAAAAAwAAAA/AAAAHgAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAACEAAAASAAAADAAAAAwAAAAtAAAAPwAAAAwAAAAMAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAAABwAAAAcAAAAH" + "AAAAPwAAAD8AAAA/AAAAPwAAAAcAAAAHAAAABwAAAAcAAAAHAAAABwAAAAcA" + "AAAHAAAABwAAAAcAAAAHAAAABwAAADgAAAA4AAAAOAAAADgAAAAHAAAABwAA" + "AAcAAAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/AAAA" + "PwAAAD8AAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAHAAAABwAAAAcAAAAA" + "AAAAAAAAAAAAAAAAAAAAOAAAADgAAAA4AAAAOAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAPwAA" + "AD8AAAAAAAAAAQAAAAEAAAABAAAAHwAAABEAAAARAAAAEQAAAAAAAAABAAAA" + "HwAAABUAAAAVAAAAFQAAABUAAAAVAAAAAAAAAA4AAAARAAAAAQAAAAcAAAAB" + "AAAAEQAAAA4AAAAAAAAAHwAAABUAAAAVAAAAFQAAABUAAAAVAAAAEQAAAAAA" + "AAAOAAAAEQAAAAEAAAAGAAAAEQAAABEAAAAOAAAAAAAAABkAAAAVAAAAFQAA" + "ABkAAAARAAAAEQAAABEAAAAAAAAAHgAAABEAAAARAAAAHgAAABAAAAAQAAAA" + "EAAAAAAAAAAeAAAAEQAAABEAAAAeAAAAEQAAABEAAAAeAAAAAAAAABEAAAAV" + "AAAAFQAAAA4AAAAVAAAAFQAAABEAAAAAAAAAEAAAAAgAAAAEAAAACgAAABEA" + "AAARAAAAEQAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAfAAAAAAAA" + "AA4AAAARAAAAEAAAABAAAAAQAAAAEQAAAA4AAAAAAAAAEAAAABAAAAAQAAAA" + "HgAAABEAAAARAAAAHgAAAAAAAAARAAAACQAAAAUAAAAPAAAAEQAAABEAAAAP" + "AAAAAAAAABEAAAARAAAAEQAAABEAAAARAAAAEQAAAB8AAAAAAAAADgAAABEA" + "AAARAAAAEQAAABEAAAARAAAADgAAAAAAAAARAAAAEQAAABEAAAAfAAAAEQAA" + "ABEAAAARAAAAAAAAABEAAAARAAAAEQAAABUAAAAVAAAAGwAAABEAAAAAAAAA" + "CQAAAAkAAAAJAAAACQAAAAkAAAAJAAAABwAAAAAAAAARAAAAEgAAABQAAAAY" + "AAAAFAAAABIAAAARAAAAAAAAABEAAAARAAAAGQAAABUAAAATAAAAEQAAABUA" + "AAAAAAAAEQAAABEAAAAZAAAAFQAAABMAAAARAAAAEQAAAAAAAAARAAAAEQAA" + "AAoAAAAEAAAACgAAABEAAAARAAAAAAAAABAAAAAQAAAAEAAAABAAAAAQAAAA" + "EQAAAB8AAAAAAAAABAAAAAQAAAAfAAAAFQAAABUAAAAfAAAABAAAAAAAAAAf" + "AAAAEAAAABAAAAAeAAAAEAAAABAAAAAfAAAAAAAAABEAAAAfAAAACgAAAAoA" + "AAAKAAAACgAAAAYAAAAAAAAAAQAAAB8AAAASAAAAEgAAABIAAAASAAAAEgAA" + "AAAAAAAeAAAAEQAAABEAAAAeAAAAEAAAABAAAAAfAAAAAAAAABEAAAARAAAA" + "HwAAABEAAAARAAAACgAAAAQAAAAAAAAAEgAAABUAAAAVAAAAHQAAABUAAAAV" + "AAAAEgAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAEQAAAA4AAAAAAAAADgAAAAIAAAACAAAAAgAA" + "AAIAAAACAAAADgAAAAAAAAAAAAAAAQAAAAIAAAAEAAAACAAAABAAAAAAAAAA" + "AAAAAA4AAAAIAAAACAAAAAgAAAAIAAAACAAAAA4AAAAAAAAAHwAAABAAAAAI" + "AAAADgAAAAIAAAABAAAAHwAAAAAAAAAEAAAABAAAAAQAAAAEAAAACgAAABEA" + "AAARAAAAAAAAABEAAAARAAAACgAAAAQAAAAKAAAAEQAAABEAAAAAAAAACgAA" + "ABUAAAAVAAAAFQAAABEAAAARAAAAEQAAAAAAAAAEAAAABAAAAAoAAAAKAAAA" + "EQAAABEAAAARAAAAAAAAAA4AAAARAAAAEQAAABEAAAARAAAAEQAAABEAAAAA" + "AAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAHwAAAAAAAAAOAAAAEQAAAAEA" + "AAAOAAAAEAAAABEAAAAOAAAAAAAAABEAAAASAAAAFAAAAB4AAAARAAAAEQAA" + "AB4AAAAAAAAADQAAABIAAAAVAAAAEQAAABEAAAARAAAADgAAAAAAAAAQAAAA" + "EAAAABAAAAAeAAAAEQAAABEAAAAeAAAAAAAAAA4AAAARAAAAEQAAABEAAAAR" + "AAAAEQAAAA4AAAAAAAAAEQAAABEAAAATAAAAFQAAABkAAAARAAAAEQAAAAAA" + "AAARAAAAEQAAABEAAAAVAAAAFQAAABsAAAARAAAAAAAAAB8AAAARAAAAEAAA" + "ABAAAAAQAAAAEAAAABAAAAAAAAAAEQAAABIAAAAUAAAAGAAAABQAAAASAAAA" + "EQAAAAAAAAAOAAAAEQAAABEAAAABAAAAAQAAAAEAAAABAAAAAAAAAA4AAAAE" + "AAAABAAAAAQAAAAEAAAABAAAAA4AAAAAAAAAEQAAABEAAAARAAAAHwAAABEA" + "AAARAAAAEQAAAAAAAAAPAAAAEQAAABMAAAAQAAAAEAAAABEAAAAOAAAAAAAA" + "ABAAAAAQAAAAEAAAAB4AAAAQAAAAEAAAAB8AAAAAAAAAHwAAABAAAAAQAAAA" + "HgAAABAAAAAQAAAAHwAAAAAAAAAeAAAACQAAAAkAAAAJAAAACQAAAAkAAAAe" + "AAAAAAAAAA4AAAARAAAAEAAAABAAAAAQAAAAEQAAAA4AAAAAAAAAHgAAABEA" + "AAARAAAAHgAAABEAAAARAAAAHgAAAAAAAAARAAAAEQAAAB8AAAARAAAAEQAA" + "AAoAAAAEAAAAAAAAAA4AAAAQAAAAFwAAABUAAAATAAAAEQAAAA4AAAAAAAAA" + "BAAAAAAAAAAEAAAAAgAAAAEAAAARAAAADgAAAAAAAAAIAAAABAAAAAIAAAAB" + "AAAAAgAAAAQAAAAIAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAfAAAAAAAAAAAA" + "AAAAAAAAAgAAAAQAAAAIAAAAEAAAAAgAAAAEAAAAAgAAAAAAAAAIAAAABAAA" + "AAwAAAAMAAAAAAAAAAwAAAAMAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAMAAAA" + "DAAAAAAAAAAAAAAAHAAAAAIAAAABAAAADwAAABEAAAARAAAADgAAAAAAAAAO" + "AAAAEQAAABEAAAAOAAAAEQAAABEAAAAOAAAAAAAAAAgAAAAIAAAACAAAAAQA" + "AAACAAAAAQAAAB8AAAAAAAAADgAAABEAAAARAAAAHgAAABAAAAAIAAAABwAA" + "AAAAAAAOAAAAEQAAAAEAAAABAAAAHgAAABAAAAAfAAAAAAAAAAIAAAACAAAA" + "HwAAABIAAAAKAAAABgAAAAIAAAAAAAAADgAAABEAAAABAAAABgAAAAIAAAAB" + "AAAAHwAAAAAAAAAfAAAAEAAAAAgAAAAGAAAAAQAAABEAAAAOAAAAAAAAAA4A" + "AAAEAAAABAAAAAQAAAAEAAAADAAAAAQAAAAAAAAADgAAABEAAAAZAAAAFQAA" + "ABMAAAARAAAADgAAAAAAAAAAAAAAEAAAAAgAAAAEAAAAAgAAAAEAAAAAAAAA" + "AAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAIAAAABAAAAAwAAAAMAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAEAAAABAAAAB8AAAAEAAAABAAAAAAAAAAAAAAAAAAA" + "AAQAAAAVAAAADgAAABUAAAAEAAAAAAAAAAAAAAAIAAAABAAAAAIAAAACAAAA" + "AgAAAAQAAAAIAAAAAAAAAAIAAAAEAAAACAAAAAgAAAAIAAAABAAAAAIAAAAA" + "AAAAAAAAAAAAAAAAAAAABAAAAAIAAAAGAAAABgAAAAAAAAANAAAAEgAAABUA" + "AAAMAAAACgAAAAoAAAAEAAAAAAAAAAMAAAATAAAACAAAAAQAAAACAAAAGQAA" + "ABgAAAAAAAAABAAAAB4AAAAFAAAADgAAABQAAAAPAAAABAAAAAAAAAAKAAAA" + "CgAAAB8AAAAKAAAAHwAAAAoAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAK" + "AAAACgAAAAoAAAAAAAAABAAAAAAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAFAAAABQAAAAUAAAA9AAAAJwAAACAAAAAgAAAA" + "OAAAAAQAAAAMAAAAHQAAAD8AAAA/AAAAHQAAAAwAAAAEAAAAAAAAAAAAAAAA" + "AAAAPwAAAD8AAAAAAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAMAAAADAAAAAwA" + "AAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAPwAAAD8AAAA/" + "AAAAPwAAAD8AAAA/AAAAPwAAAAcAAAAHAAAABwAAAAcAAAA/AAAAPwAAAD8A" + "AAA/AAAAOAAAADgAAAA4AAAAOAAAAD8AAAA/AAAAPwAAAD8AAAAAAAAAAAAA" + "AAAAAAAAAAAAOAAAADgAAAA4AAAAOAAAAD8AAAA/AAAAPwAAAD8AAAA4AAAA" + "OAAAADgAAAA4AAAABwAAAAcAAAAHAAAABwAAADgAAAA4AAAAOAAAADgAAAA4" + "AAAAOAAAADgAAAA4AAAAOAAAADgAAAA4AAAAOAAAAAAAAAAAAAAAAAAAAAAA" + "AAAMAAAAHgAAAD8AAAAMAAAADAAAAAwAAAAMAAAADAAAAAgAAAAMAAAALgAA" + "AD8AAAA/AAAALgAAAAwAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAM" + "AAAADAAAAAwAAAAMAAAAPwAAAB4AAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAhAAAAEgAAAAwAAAAMAAAALQAAAD8AAAAMAAAADAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAcAAAAHAAAA" + "BwAAAD8AAAA/AAAAPwAAAD8AAAAHAAAABwAAAAcAAAAHAAAABwAAAAcAAAAH" + "AAAABwAAAAcAAAAHAAAABwAAAAcAAAA4AAAAOAAAADgAAAA4AAAABwAAAAcA" + "AAAHAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwAA" + "AD8AAAA/AAAAPwAAAAAAAAAAAAAAAAAAAAAAAAAHAAAABwAAAAcAAAAHAAAA" + "AAAAAAAAAAAAAAAAAAAAADgAAAA4AAAAOAAAADgAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAA==";
}

// src/lib/rk86_keyboard.ts
class Keyboard {
  state;
  modifiers;
  keydown = (code) => {
    if (code === "ShiftLeft" || code === "ShiftRight")
      this.modifiers &= ~SS;
    if (code === "ControlLeft")
      this.modifiers &= ~US;
    if (code === "F10")
      this.modifiers &= ~RL;
    const key = Keyboard.key_table[code];
    if (key)
      this.state[key[0]] &= ~key[1];
  };
  keyup = (code) => {
    if (code === "ShiftLeft" || code === "ShiftRight")
      this.modifiers |= SS;
    if (code === "ControlLeft")
      this.modifiers |= US;
    if (code === "F10")
      this.modifiers |= RL;
    const key = Keyboard.key_table[code];
    if (key)
      this.state[key[0]] |= key[1];
  };
  onkeydown = (code) => this.keydown(code);
  onkeyup = (code) => this.keyup(code);
  constructor() {
    this.reset();
  }
  reset() {
    this.state = [255, 255, 255, 255, 255, 255, 255, 255];
    this.modifiers = 255;
  }
  export() {
    const h8 = (n) => "0x" + hex8(n);
    return {
      state: this.state.map(h8),
      modifiers: h8(this.modifiers)
    };
  }
  import(snapshot) {
    this.state = snapshot.state.map(fromHex);
    this.modifiers = fromHex(snapshot.modifiers);
  }
  static key_table = {
    F8: [0, 1],
    F9: [0, 2],
    F5: [0, 4],
    F1: [0, 8],
    F2: [0, 16],
    F3: [0, 32],
    F4: [0, 64],
    Tab: [1, 1],
    Backquote: [1, 2],
    Enter: [1, 4],
    Backspace: [1, 8],
    ArrowLeft: [1, 16],
    ArrowUp: [1, 32],
    ArrowRight: [1, 64],
    ArrowDown: [1, 128],
    Digit0: [2, 1],
    Digit1: [2, 2],
    Digit2: [2, 4],
    Digit3: [2, 8],
    Digit4: [2, 16],
    Digit5: [2, 32],
    Digit6: [2, 64],
    Digit7: [2, 128],
    Digit8: [3, 1],
    Digit9: [3, 2],
    F6: [3, 4],
    Semicolon: [3, 8],
    Comma: [3, 16],
    Minus: [3, 32],
    Period: [3, 64],
    Slash: [3, 128],
    F7: [4, 1],
    KeyA: [4, 2],
    KeyB: [4, 4],
    KeyC: [4, 8],
    KeyD: [4, 16],
    KeyE: [4, 32],
    KeyF: [4, 64],
    KeyG: [4, 128],
    KeyH: [5, 1],
    KeyI: [5, 2],
    KeyJ: [5, 4],
    KeyK: [5, 8],
    KeyL: [5, 16],
    KeyM: [5, 32],
    KeyN: [5, 64],
    KeyO: [5, 128],
    KeyP: [6, 1],
    KeyQ: [6, 2],
    KeyR: [6, 4],
    KeyS: [6, 8],
    KeyT: [6, 16],
    KeyU: [6, 32],
    KeyV: [6, 64],
    KeyW: [6, 128],
    KeyX: [7, 1],
    KeyY: [7, 2],
    KeyZ: [7, 4],
    BracketLeft: [7, 8],
    Backslash: [7, 16],
    BracketRight: [7, 32],
    Quote: [7, 64],
    Space: [7, 128]
  };
}
var SS = 32;
var US = 64;
var RL = 128;

// src/lib/hex_map.ts
function create(array, width = 16) {
  const v = {};
  for (let i = 0;i < array.length; i += width) {
    v[":" + hex16(i).toString()] = hexArray(array.slice(i, i + width));
  }
  return v;
}
function parse(hex2) {
  const array = [];
  for (let [label, line] of Object.entries(hex2)) {
    const address = parseInt(label.slice(1), 16);
    const line_values = line.split(" ").map((value) => parseInt(value, 16));
    for (let j = 0;j < line_values.length; j++) {
      array[address + j] = line_values[j];
    }
  }
  return array;
}

// src/lib/rk86_memory.ts
class Memory {
  buf = [];
  update_ruslat = () => {};
  machine;
  vg75_c001_00_cmd = 0;
  video_screen_size_x_buf = 0;
  video_screen_size_y_buf = 0;
  ik57_e008_80_cmd = 0;
  vg75_c001_80_cmd = 0;
  cursor_x_buf = 0;
  cursor_y_buf = 0;
  vg75_c001_60_cmd = 0;
  tape_8002_as_output = 0;
  video_memory_base_buf = 0;
  video_memory_size_buf = 0;
  video_memory_base = 0;
  video_memory_size = 0;
  video_screen_size_x = 0;
  video_screen_size_y = 0;
  video_screen_cursor_x = 0;
  video_screen_cursor_y = 0;
  last_access_address = 0;
  last_access_operation = undefined;
  constructor(machine) {
    this.machine = machine;
    this.init();
    this.invalidate_access_variables();
  }
  init() {
    this.buf = new Array(65536).fill(0);
    this.vg75_c001_00_cmd = 0;
    this.video_screen_size_x_buf = 0;
    this.video_screen_size_y_buf = 0;
    this.ik57_e008_80_cmd = 0;
    this.vg75_c001_80_cmd = 0;
    this.cursor_x_buf = 0;
    this.cursor_y_buf = 0;
    this.vg75_c001_60_cmd = 0;
    this.tape_8002_as_output = 0;
    this.video_memory_base_buf = 0;
    this.video_memory_size_buf = 0;
    this.video_memory_base = 0;
    this.video_memory_size = 0;
    this.video_screen_size_x = 0;
    this.video_screen_size_y = 0;
    this.video_screen_cursor_x = 0;
    this.video_screen_cursor_y = 0;
  }
  zero_ram() {
    for (let i = 0;i < 32768; ++i)
      this.buf[i] = 0;
  }
  snapshot(from, sz) {
    return this.buf.slice(from, from + sz);
  }
  export() {
    const h16 = (n) => "0x" + hex16(n);
    return {
      vg75_c001_00_cmd: this.vg75_c001_00_cmd,
      video_screen_size_x_buf: this.video_screen_size_x_buf,
      video_screen_size_y_buf: this.video_screen_size_y_buf,
      vg75_c001_80_cmd: this.vg75_c001_80_cmd,
      cursor_x_buf: this.cursor_x_buf,
      cursor_y_buf: this.cursor_y_buf,
      vg75_c001_60_cmd: this.vg75_c001_60_cmd,
      ik57_e008_80_cmd: this.ik57_e008_80_cmd,
      tape_8002_as_output: this.tape_8002_as_output,
      video_memory_base_buf: h16(this.video_memory_base_buf),
      video_memory_size_buf: h16(this.video_memory_size_buf),
      video_memory_base: h16(this.video_memory_base),
      video_memory_size: h16(this.video_memory_size),
      video_screen_size_x: this.video_screen_size_x,
      video_screen_size_y: this.video_screen_size_y,
      video_screen_cursor_x: this.video_screen_cursor_x,
      video_screen_cursor_y: this.video_screen_cursor_y,
      last_access_address: h16(this.last_access_address),
      last_access_operation: this.last_access_operation,
      memory: create(this.buf)
    };
  }
  import = (snapshot) => {
    const h = fromHex;
    this.vg75_c001_00_cmd = snapshot.vg75_c001_00_cmd;
    this.video_screen_size_x_buf = snapshot.video_screen_size_x_buf;
    this.video_screen_size_y_buf = snapshot.video_screen_size_y_buf;
    this.vg75_c001_80_cmd = snapshot.vg75_c001_80_cmd;
    this.cursor_x_buf = snapshot.cursor_x_buf;
    this.cursor_y_buf = snapshot.cursor_y_buf;
    this.vg75_c001_60_cmd = snapshot.vg75_c001_60_cmd;
    this.ik57_e008_80_cmd = snapshot.ik57_e008_80_cmd;
    this.tape_8002_as_output = snapshot.tape_8002_as_output;
    this.video_memory_base_buf = h(snapshot.video_memory_base_buf);
    this.video_memory_size_buf = h(snapshot.video_memory_size_buf);
    this.video_memory_base = h(snapshot.video_memory_base);
    this.video_memory_size = h(snapshot.video_memory_size);
    this.video_screen_size_x = snapshot.video_screen_size_x;
    this.video_screen_size_y = snapshot.video_screen_size_y;
    this.video_screen_cursor_x = snapshot.video_screen_cursor_x;
    this.video_screen_cursor_y = snapshot.video_screen_cursor_y;
    this.last_access_address = h(snapshot.last_access_address);
    this.last_access_operation = snapshot.last_access_operation;
    this.buf = parse(snapshot.memory);
  };
  invalidate_access_variables() {
    this.last_access_address = 0;
    this.last_access_operation = undefined;
  }
  length() {
    return 65536;
  }
  read_raw(address) {
    const addr = address & 65535;
    return this.buf[addr] & 255;
  }
  read(address) {
    const addr = address & 65535;
    this.last_access_address = addr;
    this.last_access_operation = "read";
    if (addr === 32770)
      return this.machine.keyboard.modifiers;
    if (addr === 32769) {
      const keyboard_state = this.machine.keyboard.state;
      let ch = 255;
      const kbd_scanline = ~this.buf[32768];
      for (let i = 0;i < 8; i++)
        if (1 << i & kbd_scanline)
          ch &= keyboard_state[i];
      return ch;
    }
    if (addr === 49153) {
      return 32 | (this.machine.screen.light_pen_active ? 16 : 0);
    }
    if (addr === 49152) {
      if (this.vg75_c001_60_cmd === 1) {
        this.vg75_c001_60_cmd = 2;
        return this.machine.screen.light_pen_x;
      }
      if (this.vg75_c001_60_cmd === 2) {
        this.vg75_c001_60_cmd = 0;
        return this.machine.screen.light_pen_y;
      }
      return 0;
    }
    return this.buf[addr];
  }
  write_raw(address, value8) {
    const addr = address & 65535;
    const byte = value8 & 255;
    this.buf[addr] = byte;
  }
  write = (address, value8) => {
    const addr = address & 65535;
    const byte = value8 & 255;
    this.last_access_address = addr;
    this.last_access_operation = "write";
    if (addr >= 63488)
      return;
    this.buf[addr] = byte;
    const peripheral_reg = addr & 61439;
    if (peripheral_reg === 32771) {
      if (byte & 128) {} else {
        const bit = byte >> 1 & 3;
        const value = byte & 1;
        if (bit === 3)
          this.set_ruslat(value);
      }
      return;
    }
    if (peripheral_reg === 49153 && byte === 39)
      return;
    if (peripheral_reg === 49153 && byte === 224)
      return;
    if (peripheral_reg === 49153 && byte === 128) {
      this.vg75_c001_80_cmd = 1;
      return;
    }
    if (peripheral_reg === 49152 && this.vg75_c001_80_cmd === 1) {
      this.vg75_c001_80_cmd += 1;
      this.cursor_x_buf = byte + 1;
      return;
    }
    if (peripheral_reg === 49152 && this.vg75_c001_80_cmd === 2) {
      this.cursor_y_buf = byte + 1;
      this.machine.screen.set_cursor(this.cursor_x_buf - 1, this.cursor_y_buf - 1);
      this.video_screen_cursor_x = this.cursor_x_buf;
      this.video_screen_cursor_y = this.cursor_y_buf;
      this.vg75_c001_80_cmd = 0;
      return;
    }
    if (peripheral_reg === 49153 && byte === 96) {
      if (this.machine.screen.light_pen_active)
        this.vg75_c001_60_cmd = 1;
      return;
    }
    if (peripheral_reg === 49153 && byte === 0) {
      this.vg75_c001_00_cmd = 1;
      return;
    }
    if (peripheral_reg === 49152 && this.vg75_c001_00_cmd === 1) {
      this.video_screen_size_x_buf = (byte & 127) + 1;
      this.vg75_c001_00_cmd += 1;
      return;
    }
    if (peripheral_reg === 49152 && this.vg75_c001_00_cmd === 2) {
      this.video_screen_size_y_buf = (byte & 63) + 1;
      this.vg75_c001_00_cmd += 1;
      return;
    }
    if (peripheral_reg === 49152 && this.vg75_c001_00_cmd === 3) {
      this.vg75_c001_00_cmd += 1;
      return;
    }
    if (peripheral_reg === 49152 && this.vg75_c001_00_cmd === 4) {
      this.vg75_c001_00_cmd = 0;
      if (this.video_screen_size_x_buf && this.video_screen_size_y_buf) {
        this.video_screen_size_x = this.video_screen_size_x_buf;
        this.video_screen_size_y = this.video_screen_size_y_buf;
        this.machine.screen.set_geometry(this.video_screen_size_x, this.video_screen_size_y);
      }
      return;
    }
    if (peripheral_reg === 57352 && byte === 128) {
      this.ik57_e008_80_cmd = 1;
      this.tape_8002_as_output = 1;
      return;
    }
    if (peripheral_reg === 57348 && this.ik57_e008_80_cmd === 1) {
      this.video_memory_base_buf = byte;
      this.ik57_e008_80_cmd += 1;
      return;
    }
    if (peripheral_reg === 57348 && this.ik57_e008_80_cmd === 2) {
      this.video_memory_base_buf |= byte << 8;
      this.ik57_e008_80_cmd += 1;
      return;
    }
    if (peripheral_reg === 57349 && this.ik57_e008_80_cmd === 3) {
      this.video_memory_size_buf = byte;
      this.ik57_e008_80_cmd += 1;
      return;
    }
    if (peripheral_reg === 57349 && this.ik57_e008_80_cmd === 4) {
      this.video_memory_size_buf = ((this.video_memory_size_buf | byte << 8) & 16383) + 1;
      this.ik57_e008_80_cmd = 0;
      this.video_memory_base = this.video_memory_base_buf;
      this.video_memory_size = this.video_memory_size_buf;
      this.machine.screen.set_video_memory(this.video_memory_base);
      return;
    }
    if (peripheral_reg === 57352 && byte === 164) {
      this.tape_8002_as_output = 0;
      return;
    }
    if (addr === 32770) {
      if (this.tape_8002_as_output) {
        this.tape_write_bit(byte & 1);
      }
      return;
    }
  };
  tape_write_bit(bit) {
    this.machine.tape.write_bit(bit);
  }
  set_ruslat(value) {
    if (this.update_ruslat)
      this.update_ruslat(value);
  }
  load_file(file) {
    for (let i = file.start;i <= file.end; ++i) {
      this.write_raw(i, file.image[i - file.start]);
    }
  }
}

// src/lib/SoundPlayer.ts
class SoundPlayer {
  audioCtx;
  gainNode;
  oscillator = null;
  constructor(audioContext) {
    this.audioCtx = audioContext;
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
  }
  play(freq, volume, wave) {
    this.oscillator = this.audioCtx.createOscillator();
    this.oscillator.connect(this.gainNode);
    this.oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    if (wave) {
      this.oscillator.type = wave;
    }
    this.gainNode.gain.value = volume;
    this.oscillator.start();
  }
  stop(when) {
    const offset = when || 0.05;
    if (this.oscillator)
      this.oscillator.stop(this.audioCtx.currentTime + offset);
  }
}

// src/lib/rk86_sound.ts
class Sound {
  volume = 0.05;
  stop_timer = null;
  previous_tone = null;
  player;
  constructor() {
    const ctx = new AudioContext;
    ctx.resume();
    this.player = new SoundPlayer(ctx);
  }
  set_stop_timer(duration) {
    return setTimeout(() => {
      this.player.stop();
      this.previous_tone = null;
    }, duration * 1000);
  }
  play(tone, duration) {
    clearTimeout(this.stop_timer);
    if (this.previous_tone !== tone) {
      if (this.previous_tone)
        this.player.stop();
      this.player.play(tone, this.volume, "square");
    }
    this.previous_tone = tone;
    this.stop_timer = this.set_stop_timer(duration);
  }
}

// src/lib/rk86_runner.ts
class Runner {
  paused = false;
  tracer = null;
  last_instructions = [];
  previous_batch_time = 0;
  total_ticks = 0;
  last_iff_raise_ticks = 0;
  last_iff = 0;
  sound = null;
  instructions_per_millisecond = 0;
  ticks_per_millisecond = 0;
  FREQ = 1780000;
  TICK_PER_MS;
  execute_timer;
  machine;
  constructor(machine) {
    this.machine = machine;
    this.TICK_PER_MS = this.FREQ / 100;
    this.machine.io.interrupt = (iff) => this.interrupt(iff);
    this.machine.cpu.jump(63488);
  }
  interrupt(iff) {
    if (!this.sound)
      return;
    if (this.last_iff == iff)
      return;
    if (this.last_iff == 0 && iff == 1) {
      this.last_iff_raise_ticks = this.total_ticks;
    }
    if (this.last_iff == 1 && iff == 0) {
      const tone_ticks = this.total_ticks - this.last_iff_raise_ticks;
      const tone = this.FREQ / (tone_ticks * 2);
      const duration = 1 / tone;
      this.sound.play(tone, duration);
    }
    this.last_iff = iff;
  }
  init_sound(enabled) {
    if (enabled && this.sound == null) {
      this.sound = new Sound;
      console.log("\u0437\u0432\u0443\u043A \u0432\u043A\u043B\u044E\u0447\u0435\u043D");
    } else if (!enabled) {
      this.sound = null;
      console.log("\u0437\u0432\u0443\u043A \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D");
    }
  }
  execute() {
    clearTimeout(this.execute_timer);
    if (!this.paused) {
      let batch_ticks = 0;
      let batch_instructions = 0;
      while (batch_ticks < this.TICK_PER_MS) {
        if (this.tracer) {
          this.tracer("before");
          if (this.paused)
            break;
        }
        this.last_instructions.push(this.machine.cpu.pc);
        if (this.last_instructions.length > 5) {
          this.last_instructions.shift();
        }
        this.machine.memory.invalidate_access_variables();
        const instruction_ticks = this.machine.cpu.instruction();
        batch_ticks += instruction_ticks;
        this.total_ticks += instruction_ticks;
        if (this.tracer) {
          this.tracer("after");
          if (this.paused)
            break;
        }
        if (this.machine.ui.visualizer_visible && this.machine.ui.on_visualizer_hit) {
          this.machine.ui.on_visualizer_hit(this.machine.memory.read_raw(this.machine.cpu.pc));
        }
        batch_instructions += 1;
      }
      const now = performance.now();
      const elapsed = now - this.previous_batch_time;
      this.previous_batch_time = now;
      this.instructions_per_millisecond = batch_instructions / elapsed;
      this.ticks_per_millisecond = batch_ticks / elapsed;
    }
    this.execute_timer = setTimeout(() => this.execute(), 10);
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
  }
  reset() {
    this.machine.cpu.jump(63488);
    this.machine.keyboard.reset();
  }
}

// src/lib/rk86_screen.ts
class Screen {
  static #update_rate = 25;
  machine;
  cursor_rate;
  char_width;
  char_height;
  char_height_gap;
  cursor_width;
  cursor_height;
  scale_x;
  scale_y;
  width;
  height;
  cursor_state;
  cursor_x;
  cursor_y;
  last_cursor_state;
  last_cursor_x;
  last_cursor_y;
  font;
  light_pen_x;
  light_pen_y;
  light_pen_active;
  ctx;
  constructor(machine) {
    this.machine = machine;
    this.cursor_rate = 500;
    this.char_width = 6;
    this.char_height = 8;
    this.char_height_gap = 2;
    this.cursor_width = this.char_width;
    this.cursor_height = 1;
    this.scale_x = 1;
    this.scale_y = 1;
    this.width = 78;
    this.height = 30;
    this.cursor_state = false;
    this.cursor_x = 0;
    this.cursor_y = 0;
    this.last_cursor_state = false;
    this.last_cursor_x = 0;
    this.last_cursor_y = 0;
    this.font = new Image;
    this.font.src = this.machine.font;
    this.light_pen_x = 0;
    this.light_pen_y = 0;
    this.light_pen_active = 0;
  }
  export() {
    const h16 = (n) => "0x" + hex16(n);
    return {
      scale_x: this.scale_x,
      scale_y: this.scale_y,
      width: this.width,
      height: this.height,
      cursor_state: this.cursor_state ? 1 : 0,
      cursor_x: this.cursor_x,
      cursor_y: this.cursor_y,
      video_memory_base: h16(this.video_memory_base),
      video_memory_size: h16(this.video_memory_size),
      light_pen_x: this.light_pen_x,
      light_pen_y: this.light_pen_y,
      light_pen_active: this.light_pen_active
    };
  }
  import(snapshot) {
    const h = fromHex;
    this.scale_x = h(snapshot.scale_x);
    this.scale_y = h(snapshot.scale_y);
    this.width = h(snapshot.width);
    this.height = h(snapshot.height);
    this.cursor_state = h(snapshot.cursor_state) ? true : false;
    this.cursor_x = h(snapshot.cursor_x);
    this.cursor_y = h(snapshot.cursor_y);
    this.video_memory_base = h(snapshot.video_memory_base);
    this.video_memory_size = h(snapshot.video_memory_size);
    this.light_pen_x = h(snapshot.light_pen_x);
    this.light_pen_y = h(snapshot.light_pen_y);
    this.light_pen_active = h(snapshot.light_pen_active);
  }
  apply_import() {
    this.set_geometry(this.width, this.height);
    this.set_video_memory(this.video_memory_base);
  }
  start() {
    this.init();
    this.draw_screen();
    this.flip_cursor();
    this.machine.ui.canvas.onmousemove = this.handle_mousemove.bind(this);
    this.machine.ui.canvas.onmouseup = () => this.light_pen_active = 0;
    this.machine.ui.canvas.onmousedown = () => this.light_pen_active = 1;
  }
  cache = [];
  init_cache(sz) {
    for (let i = 0;i < sz; ++i)
      this.cache[i] = -1;
  }
  draw_char(x, y, ch) {
    this.ctx.drawImage(this.font, 2, this.char_height * ch, this.char_width, this.char_height, x * this.char_width * this.scale_x, y * (this.char_height + this.char_height_gap) * this.scale_y, this.char_width * this.scale_x, this.char_height * this.scale_y);
  }
  draw_cursor(x, y, visible) {
    const cy = (y2) => (y2 * (this.char_height + this.char_height_gap) + this.char_height) * this.scale_y;
    if (this.last_cursor_x !== x || this.last_cursor_y !== y) {
      if (this.last_cursor_state) {
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(this.last_cursor_x * this.char_width * this.scale_x, cy(this.last_cursor_y), this.cursor_width * this.scale_x, this.cursor_height * this.scale_y);
      }
      this.last_cursor_state = this.cursor_state;
      this.last_cursor_x = x;
      this.last_cursor_y = y;
    }
    const cx = x * this.char_width * this.scale_x;
    this.ctx.fillStyle = visible ? "#ffffff" : "#000000";
    this.ctx.fillRect(cx, cy(y), this.cursor_width * this.scale_x, this.cursor_height * this.scale_y);
  }
  flip_cursor() {
    this.draw_cursor(this.cursor_x, this.cursor_y, this.cursor_state);
    this.cursor_state = !this.cursor_state;
    setTimeout(() => this.flip_cursor(), this.cursor_rate);
  }
  init() {
    this.ctx = this.machine.ui.canvas.getContext("2d");
  }
  disable_smoothing() {
    this.ctx.imageSmoothingEnabled = false;
  }
  last_width = 0;
  last_height = 0;
  video_memory_size = 0;
  set_geometry(width, height) {
    this.width = width;
    this.height = height;
    this.video_memory_size = width * height;
    this.machine.ui.update_screen_geometry(this.width, this.height);
    const canvas_width = this.width * this.char_width * this.scale_x;
    const canvas_height = this.height * (this.char_height + this.char_height_gap) * this.scale_y;
    this.machine.ui.resize_canvas(canvas_width, canvas_height);
    this.disable_smoothing();
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, canvas_width, canvas_height);
    if (this.last_width === this.width && this.last_height === this.height)
      return;
    console.log(`\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u0440\u0430\u0437\u043C\u0435\u0440 \u044D\u043A\u0440\u0430\u043D\u0430: ${width} x ${height}`);
    this.last_width = this.width;
    this.last_height = this.height;
  }
  video_memory_base = 0;
  last_video_memory_base = 0;
  set_video_memory(base) {
    this.video_memory_base = base;
    this.init_cache(this.video_memory_size);
    this.machine.ui.update_video_memory_address(this.video_memory_base);
    if (this.last_video_memory_base === this.video_memory_base)
      return;
    console.log(`\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0432\u0438\u0434\u0435\u043E\u043F\u0430\u043C\u044F\u0442\u044C \u0441 \u0430\u0434\u0440\u0435\u0441\u0430`, `${hex16(this.video_memory_base)}`, `\u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C ${hex16(this.video_memory_size)}`);
    this.last_video_memory_base = this.video_memory_base;
  }
  set_cursor(x, y) {
    this.draw_cursor(this.cursor_x, this.cursor_y, false);
    this.cursor_x = x;
    this.cursor_y = y;
  }
  draw_screen() {
    const memory = this.machine.memory;
    let i = this.video_memory_base;
    for (let y = 0;y < this.height; ++y) {
      for (let x = 0;x < this.width; ++x) {
        const cache_i = i - this.video_memory_base;
        const ch = memory.read(i);
        if (this.cache[cache_i] !== ch) {
          this.draw_char(x, y, ch);
          this.cache[cache_i] = ch;
        }
        i += 1;
      }
    }
    setTimeout(() => this.draw_screen(), Screen.#update_rate);
  }
  handle_mousemove(event) {
    const canvas = this.machine.ui.canvas;
    const box = canvas.getBoundingClientRect();
    const scaleX = canvas.width / box.width;
    const scaleY = canvas.height / box.height;
    const mouseX = (event.clientX - box.left) * scaleX;
    const mouseY = (event.clientY - box.top) * scaleY;
    const x = Math.floor(mouseX / (this.char_width * this.scale_x));
    const y = Math.floor(mouseY / ((this.char_height + this.char_height_gap) * this.scale_y));
    this.light_pen_x = x;
    this.light_pen_y = y;
  }
}

// src/lib/rk86_tape.ts
class Tape {
  machine;
  previous_bit_ticks = 0;
  bit_started = false;
  bit_count = 0;
  current_byte = 0;
  written_bytes = [];
  written_bytes_from_e6 = 0;
  output_block_count = 0;
  output_timer = null;
  constructor(machine) {
    this.machine = machine;
  }
  save(bytes) {
    const binary = new Uint8Array(bytes);
    const blob = new Blob([binary], { type: "image/gif" });
    const filename = `rk86-tape-${this.output_block_count}.bin`;
    Tape.saveAs(blob, filename);
    this.output_block_count += 1;
  }
  log(bytes) {
    for (let i = 0;i < bytes.length; i += 16) {
      const line = bytes.slice(i, i + 16);
      console.log(i.toString(16).padStart(4, "0").toUpperCase() + ":", line.map((byte) => byte.toString(16).padStart(2, "0")).join(" "));
    }
  }
  write_ended = () => {
    this.bit_started = false;
    this.current_byte = 0;
    this.bit_count = 0;
    this.written_bytes = [];
    this.written_bytes_from_e6 = 0;
    const ui = this.machine.ui;
    ui.update_activity_indicator(false);
    ui.hightlight_written_bytes(false);
  };
  flush = () => {
    const sync_byte_index = this.written_bytes.findIndex((byte) => byte === 230);
    if (sync_byte_index === -1) {
      console.error("sync byte E6 is not found");
      this.log(this.written_bytes);
    } else {
      console.log(`${sync_byte_index} bytes before sync byte`);
      const bytes = this.written_bytes.slice(sync_byte_index);
      this.log(bytes);
      this.save(bytes);
    }
    this.write_ended();
  };
  write_bit = (bit) => {
    const runner_ticks = this.machine.runner.total_ticks;
    const time = runner_ticks - this.previous_bit_ticks;
    if (time > 1e4) {
      console.log("reset tape buffer due to timeout");
      this.write_ended();
    }
    if (!this.bit_started) {
      this.bit_started = true;
    } else {
      this.bit_started = false;
      this.current_byte |= (bit ? 128 : 0) >> this.bit_count;
      if (this.bit_count < 7) {
        this.bit_count += 1;
      } else {
        this.written_bytes.push(this.current_byte);
        if (this.current_byte === 230 || this.written_bytes_from_e6 > 0) {
          this.written_bytes_from_e6 += 1;
        }
        if (this.written_bytes.length === 1) {
          this.machine.ui.update_activity_indicator(true);
          this.machine.ui.update_written_bytes(0);
        }
        if (this.written_bytes_from_e6 === 1)
          this.machine.ui.hightlight_written_bytes(true);
        if (this.written_bytes_from_e6 > 0)
          this.machine.ui.update_written_bytes(this.written_bytes_from_e6);
        if (this.output_timer)
          clearTimeout(this.output_timer);
        this.output_timer = setTimeout(this.flush, 1000);
        this.current_byte = 0;
        this.bit_count = 0;
      }
    }
    this.previous_bit_ticks = runner_ticks;
  };
  static saveAs(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

// src/lib/rk86_terminal.ts
globalThis.Image = class {
};
var charMap = {
  0: " ",
  1: "\u2598",
  2: "\u259D",
  3: "\u2580",
  4: "\u2596",
  5: "\u258C",
  6: "\u259E",
  7: "\u259B",
  8: " ",
  9: "\u273F",
  10: " ",
  11: "\u2191",
  12: " ",
  13: " ",
  14: "\u25C0",
  15: "\u25BC",
  16: "\u2597",
  17: "\u259A",
  18: "\u2590",
  19: "\u259C",
  20: "\u2584",
  21: "\u2599",
  22: "\u259F",
  23: "\u2588",
  24: " ",
  25: " ",
  26: " ",
  27: "\u2502",
  28: "\u2500",
  29: "\u25B6",
  30: "\u2310",
  31: " ",
  32: " ",
  33: "!",
  34: '"',
  35: "#",
  36: "$",
  37: "%",
  38: "&",
  39: "'",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  44: ",",
  45: "-",
  46: ".",
  47: "/",
  48: "0",
  49: "1",
  50: "2",
  51: "3",
  52: "4",
  53: "5",
  54: "6",
  55: "7",
  56: "8",
  57: "9",
  58: ":",
  59: ";",
  60: "<",
  61: "=",
  62: ">",
  63: "?",
  64: "@",
  65: "A",
  66: "B",
  67: "C",
  68: "D",
  69: "E",
  70: "F",
  71: "G",
  72: "H",
  73: "I",
  74: "J",
  75: "K",
  76: "L",
  77: "M",
  78: "N",
  79: "O",
  80: "P",
  81: "Q",
  82: "R",
  83: "S",
  84: "T",
  85: "U",
  86: "V",
  87: "W",
  88: "X",
  89: "Y",
  90: "Z",
  91: "[",
  92: "\\",
  93: "]",
  94: "^",
  95: "_",
  96: "\u042E",
  97: "\u0410",
  98: "\u0411",
  99: "\u0426",
  100: "\u0414",
  101: "\u0415",
  102: "\u0424",
  103: "\u0413",
  104: "\u0425",
  105: "\u0418",
  106: "\u0419",
  107: "\u041A",
  108: "\u041B",
  109: "\u041C",
  110: "\u041D",
  111: "\u041E",
  112: "\u041F",
  113: "\u042F",
  114: "\u0420",
  115: "\u0421",
  116: "\u0422",
  117: "\u0423",
  118: "\u0416",
  119: "\u0412",
  120: "\u042C",
  121: "\u042B",
  122: "\u0417",
  123: "\u0428",
  124: "\u042D",
  125: "\u0429",
  126: "\u0427",
  127: "\u2588"
};
for (let i = 0;i < 128; i++)
  charMap[128 + i] = charMap[i];
function rk86char(byte) {
  return charMap[byte & 255] ?? "\xB7";
}

class TerminalUI {
  canvas = { getContext: () => null, width: 0, height: 0 };
  visualizer_visible = false;
  terminal = { put: () => {}, history: [] };
  i8080disasm;
  visualizer;
  toggle_assembler;
  on_visualizer_hit;
  on_pause_changed;
  refreshDebugger;
  resize_canvas() {}
  update_screen_geometry() {}
  update_video_memory_address() {}
  update_ruslat = () => {};
  update_activity_indicator = () => {};
  update_written_bytes = () => {};
  hightlight_written_bytes = () => {};
  start_update_perf = () => {};
  screenshot() {}
  memory_snapshot() {}
  emulator_snapshot() {}
}

class IO {
  input = (_port) => 0;
  output = (_port, _w8) => {};
  interrupt = (_iff) => {};
}

class TerminalScreen {
  machine;
  width = 78;
  height = 30;
  video_memory_base = 0;
  timer;
  constructor(machine) {
    this.machine = machine;
  }
  start() {
    this.render();
  }
  render() {
    const { memory, screen } = this.machine;
    const cursorX = screen.cursor_x;
    const cursorY = screen.cursor_y;
    const cursorVisible = screen.cursor_state;
    let output = "\x1B[H";
    let addr = this.video_memory_base;
    for (let y = 0;y < this.height; y++) {
      let line = "";
      for (let x = 0;x < this.width; x++) {
        const ch = rk86char(memory.read(addr));
        if (x === cursorX && y === cursorY) {
          line += `\x1B[4m${ch}\x1B[0m`;
        } else {
          line += ch;
        }
        addr++;
      }
      output += line + `
`;
    }
    process.stdout.write(output);
    this.timer = setTimeout(() => this.render(), 40);
  }
}
var KEY_MAP = {
  a: "KeyA",
  b: "KeyB",
  c: "KeyC",
  d: "KeyD",
  e: "KeyE",
  f: "KeyF",
  g: "KeyG",
  h: "KeyH",
  i: "KeyI",
  j: "KeyJ",
  k: "KeyK",
  l: "KeyL",
  m: "KeyM",
  n: "KeyN",
  o: "KeyO",
  p: "KeyP",
  q: "KeyQ",
  r: "KeyR",
  s: "KeyS",
  t: "KeyT",
  u: "KeyU",
  v: "KeyV",
  w: "KeyW",
  x: "KeyX",
  y: "KeyY",
  z: "KeyZ",
  "0": "Digit0",
  "1": "Digit1",
  "2": "Digit2",
  "3": "Digit3",
  "4": "Digit4",
  "5": "Digit5",
  "6": "Digit6",
  "7": "Digit7",
  "8": "Digit8",
  "9": "Digit9",
  "\r": "Enter",
  "\n": "Enter",
  "\t": "Tab",
  "\x7F": "Backspace",
  "\b": "Backspace",
  " ": "Space",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "-": "Minus",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  "`": "Backquote",
  "'": "Quote",
  "\x1B[A": "ArrowUp",
  "\x1B[B": "ArrowDown",
  "\x1B[C": "ArrowRight",
  "\x1B[D": "ArrowLeft",
  "\x1BOP": "F1",
  "\x1BOQ": "F2",
  "\x1BOR": "F3",
  "\x1BOS": "F4",
  "\x1B[15~": "F5",
  "\x1B[17~": "F6",
  "\x1B[18~": "F7",
  "\x1B[19~": "F8",
  "\x1B[20~": "F9",
  "\x1B[21~": "F10"
};
function setupKeyboard(keyboard) {
  if (!process.stdin.isTTY)
    return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (data) => {
    if (data === "\x03") {
      process.stdout.write("\x1B[?25h");
      process.stdout.write("\x1B[2J\x1B[H");
      process.exit(0);
    }
    const code = KEY_MAP[data] || KEY_MAP[data.toLowerCase()];
    if (code) {
      if (data.length === 1 && data >= "A" && data <= "Z") {
        keyboard.onkeydown("ShiftLeft");
      }
      keyboard.onkeydown(code);
      setTimeout(() => {
        keyboard.onkeyup(code);
        if (data.length === 1 && data >= "A" && data <= "Z") {
          keyboard.onkeyup("ShiftLeft");
        }
      }, 50);
    }
  });
}
async function fetchFile(name) {
  try {
    const data = await Bun.file(`static/files/${name}`).arrayBuffer();
    return Array.from(new Uint8Array(data));
  } catch {
    console.error(`\u043E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0444\u0430\u0439\u043B\u0430: ${name}`);
  }
}
async function main() {
  const programFile = process.argv[2];
  const keyboard = new Keyboard;
  const io = new IO;
  const machineBuilder = {
    font: rk86_font_image(),
    keyboard,
    io
  };
  const machine = machineBuilder;
  machine.ui = new TerminalUI;
  machine.memory = new Memory(machine);
  machine.cpu = new I8080(machine);
  machine.screen = new Screen(machine);
  machine.tape = new Tape(machine);
  machine.runner = new Runner(machine);
  machine.memory.update_ruslat = machine.ui.update_ruslat;
  const monitorContent = await fetchFile("mon32.bin");
  if (!monitorContent) {
    console.error("\u043E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0430 mon32.bin");
    process.exit(1);
  }
  const monitorFile = parse_rk86_binary("mon32.bin", monitorContent);
  machine.memory.load_file(monitorFile);
  if (programFile) {
    const content = await fetchFile(programFile);
    if (content) {
      const file = parse_rk86_binary(programFile, content);
      machine.memory.load_file(file);
      console.error(`\u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D: ${programFile} (${file.start.toString(16)}-${file.end.toString(16)}, G${file.entry.toString(16)})`);
    }
  }
  process.stdout.write("\x1B[?25l");
  process.stdout.write("\x1B[2J");
  setupKeyboard(keyboard);
  const termScreen = new TerminalScreen(machine);
  const origSetGeometry = machine.screen.set_geometry.bind(machine.screen);
  machine.screen.set_geometry = (width, height) => {
    origSetGeometry(width, height);
    termScreen.width = width;
    termScreen.height = height;
  };
  const origSetVideoMemory = machine.screen.set_video_memory.bind(machine.screen);
  machine.screen.set_video_memory = (base) => {
    origSetVideoMemory(base);
    termScreen.video_memory_base = base;
  };
  const noopCtx = {
    imageSmoothingEnabled: false,
    fillStyle: "",
    fillRect() {},
    drawImage() {},
    clearRect() {}
  };
  machine.screen.ctx = noopCtx;
  machine.screen.init = () => {
    machine.screen.ctx = noopCtx;
  };
  machine.screen.draw_screen = () => {};
  machine.screen.draw_cursor = () => {};
  machine.screen.start();
  machine.runner.execute();
  termScreen.start();
  process.on("exit", () => {
    process.stdout.write("\x1B[?25h");
  });
}
main();
