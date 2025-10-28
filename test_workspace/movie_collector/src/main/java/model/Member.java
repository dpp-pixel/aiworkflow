package model;

import lombok.Data;

@Data
public class Member {
	private int member_seq;
	private String id;
	private String pw;
	private String email;
	private String nickname;
}