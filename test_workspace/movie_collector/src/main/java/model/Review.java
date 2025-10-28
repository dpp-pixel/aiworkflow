package model;

import lombok.Data;

@Data
public class Review {
	private int review_seq;
	private String score;
	private String review;
	private String writer;
	private int member_seq;//DB에는 없는 컬럼
	private String movie_code;
}