def next_offset(offset, count, total):
    return offset + count if count > 0 and offset + count < total else None
